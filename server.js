// server.js
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(__dirname));

// redirige "/" a Slider.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'Slider.html'));
});

// (opcional) /new crea una sala aleatoria y redirige
function slug() {
  const s = () => Math.random().toString(36).slice(2, 5);
  return `sala-${s()}-${s()}`;
}
app.get('/new', (_req, res) => {
  res.redirect(`/Slider.html?room=${slug()}`);
});

// health-check
app.get('/health', (_req, res) => res.type('text').send('OK'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map();
function joinRoom(ws, room) {
  if (ws.room && rooms.has(ws.room)) {
    const set = rooms.get(ws.room);
    set.delete(ws);
    if (set.size === 0) rooms.delete(ws.room);
  }
  ws.room = room;
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
}
function broadcastTo(room, data, except = null) {
  const set = rooms.get(room);
  if (!set) return;
  for (const c of set) if (c !== except && c.readyState === 1) c.send(data);
}

function heartbeat() { this.isAlive = true; }
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000);

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  try {
    const u = new URL(req.url, 'http://x');
    joinRoom(ws, u.searchParams.get('room') || 'default');
  } catch {
    joinRoom(ws, 'default');
  }

  ws.on('message', (buf) => {
    let msg = null;
    try { msg = JSON.parse(buf.toString()); } catch {}

    if (msg && msg.type === 'join' && typeof msg.room === 'string') {
      joinRoom(ws, msg.room);
      return;
    }

    const room = (msg && typeof msg.room === 'string') ? msg.room : (ws.room || 'default');

    if (msg && msg.type === 'slider') {
      let v = Number(msg.value);
      if (!Number.isFinite(v)) v = 0;
      v = Math.max(0, Math.min(1, v));
      return broadcastTo(room, JSON.stringify({ type: 'state', value: v, room }));
    }

    if (msg && typeof msg === 'object') {
      if (!('room' in msg)) msg.room = room;
      return broadcastTo(room, JSON.stringify(msg));
    }

    broadcastTo(room, buf);
  });

  ws.on('close', () => {
    const set = rooms.get(ws.room);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(ws.room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('HTTP+WS listo en :' + PORT));
