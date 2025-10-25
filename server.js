// server.js (ESM). Requiere "type":"module" en package.json.
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Sirve archivos estáticos (Slider.html, Slider_app.js, Slider_styles.css en la misma carpeta)
app.use(express.static(__dirname));
// health-check
app.get('/health', (_req, res) => res.type('text').send('OK'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---- Rooms: Map<string, Set<WebSocket>>
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
  for (const client of set) {
    if (client !== except && client.readyState === 1) {
      client.send(data);
    }
  }
}

// heartbeat
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

  // Determina room desde la query (?room=xxx), default "default"
  try {
    const u = new URL(req.url, 'http://x');
    const room = u.searchParams.get('room') || 'default';
    joinRoom(ws, room);
  } catch {
    joinRoom(ws, 'default');
  }

  ws.on('message', (buf) => {
    let msg = null;
    try { msg = JSON.parse(buf.toString()); } catch { }

    // Cambiar de sala si llega un join explícito
    if (msg && msg.type === 'join' && typeof msg.room === 'string') {
      joinRoom(ws, msg.room);
      return;
    }

    const room = (msg && typeof msg.room === 'string') ? msg.room : (ws.room || 'default');

    // Normalizamos "slider" -> "state" (0..1) y lo difundimos en la sala
    if (msg && msg.type === 'slider') {
      let v = Number(msg.value);
      if (!Number.isFinite(v)) v = 0;
      v = Math.max(0, Math.min(1, v));
      const out = JSON.stringify({ type: 'state', value: v, room });
      return broadcastTo(room, out);
    }

    // Reenvía otros mensajes dentro de la sala, adjuntando room si falta
    if (msg && typeof msg === 'object') {
      if (!('room' in msg)) msg.room = room;
      return broadcastTo(room, JSON.stringify(msg));
    }

    // Si no es JSON, igualmente reenvía dentro de la sala
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
