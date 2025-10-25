// server.js  — HTTP estático + WebSocket con "rooms" y traducción slider->state
// CommonJS para Render (sin ES modules)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 10000;
const PUBLIC = __dirname; // los archivos están en la raíz del repo

// ---- Utilidades HTTP (estáticos simples) ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

function sendFile(res, filePath, code = 200) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(code, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function handleHttp(req, res) {
  const url = new URL(req.url, 'http://x');
  const pathname = url.pathname;

  // Health check
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  // Página principal -> Slider.html (conservar query ?room=...)
  if (pathname === '/' || pathname === '/slider' || pathname.toLowerCase() === '/slider.html') {
    return sendFile(res, path.join(PUBLIC, 'Slider.html'));
  }

  // Estáticos (JS/CSS/…)
  const candidate = path.join(PUBLIC, pathname.replace(/^\/+/, ''));
  // Seguridad mínima: no permitir salir del PUBLIC
  if (!candidate.startsWith(PUBLIC)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.stat(candidate, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    sendFile(res, candidate);
  });
}

// ---- HTTP server ----
const server = http.createServer(handleHttp);

// ---- WebSocket "rooms" ----
const wss = new WebSocketServer({ noServer: true });

// estado por sala (último valor conocido)
const rooms = new Map();          // roomId -> Set<WebSocket>
const lastValue = new Map();      // roomId -> number

function getRoomSet(room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  return rooms.get(room);
}

function broadcast(room, payload, exceptWs = null) {
  const set = rooms.get(room);
  if (!set) return;
  for (const client of set) {
    if (client !== exceptWs && client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/ws') return socket.destroy();

    const room = (url.searchParams.get('room') || 'default').slice(0, 64);

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.__room = room;
      wss.emit('connection', ws, req);
    });
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  const room = ws.__room || 'default';
  const set = getRoomSet(room);
  set.add(ws);

  // Enviar estado inicial si lo hay
  if (lastValue.has(room)) {
    const v = lastValue.get(room);
    ws.send(JSON.stringify({ type: 'state', value: v, room }));
  }

  // Mensajes entrantes
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return; // ignorar no-JSON
    }

    // Aceptamos dos tipos:
    // - {type:'state', value} desde la web
    // - {type:'slider', value} desde TouchDesigner
    if (msg && (msg.type === 'state' || msg.type === 'slider')) {
      let v = Number(msg.value);
      if (!Number.isFinite(v)) v = 0;
      v = Math.max(0, Math.min(1, v));
      lastValue.set(room, v);

      // Si viene de TD (slider) lo traducimos a 'state'
      const out = { type: 'state', value: v, room };
      broadcast(room, JSON.stringify(out), null);
      return;
    }

    // Opcional: pings u otros
    if (msg && msg.type === 'ping') {
      try { ws.send(JSON.stringify({ type: 'pong' })); } catch {}
    }
  });

  ws.on('close', () => {
    const set = rooms.get(room);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(room);
    }
  });
});

server.listen(PORT, () => {
  console.log(`HTTP on :${PORT}`);
  console.log(`WS   on /ws  (use wss://<tu-dominio>/ws?room=miSala)`);
});

