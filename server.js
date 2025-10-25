// server.js — WebSocket + HTTP (Express) para slider Touch/Web sin eco
// Ejecuta con: node server.js  (Render usa process.env.PORT)

'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const url = require('url');

const PORT = process.env.PORT || 10000;

// --- HTTP (estático opcional: Slider.html, css/js, etc.) ---
const app = express();
app.use(express.static(path.join(__dirname))); // sirve archivos del repo
app.get('/', (_req, res) => {
  // si entras a la raíz, redirige al slider por comodidad
  res.redirect('/Slider.html');
});

const server = http.createServer(app);

// --- WS en /ws ---------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

// Conjunto de clientes por sala: Map<room, Set<ws>>
const rooms = new Map();
// Último valor por sala: Map<room, number>
const lastValue = new Map();

function getRoomFromRequest(req) {
  // req.url viene como "/ws?room=xxxx"
  try {
    const parsed = url.parse(req.url, true);
    const q = parsed.query || {};
    const room = `${q.room || 'default'}`.trim();
    // sanea nombres raros
    return room || 'default';
  } catch {
    return 'default';
  }
}

function addToRoom(room, ws) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
}

function removeFromRoom(room, ws) {
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      rooms.delete(room);
      lastValue.delete(room);
    }
  }
}

function clamp01(x) {
  const v = Number(x);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function safeSend(ws, obj) {
  try {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  } catch (_) { /* no-op */ }
}

function broadcastToRoom(room, payload, exceptWs = null) {
  const set = rooms.get(room);
  if (!set) return;
  for (const client of set) {
    if (client === exceptWs) continue; // *** evita ECO ***
    safeSend(client, payload);
  }
}

wss.on('connection', (ws, req) => {
  const room = getRoomFromRequest(req);
  addToRoom(room, ws);

  console.log(`[WS] + client in room="${room}" (total ${rooms.get(room).size})`);

  // Saludo y estado inicial de la sala
  safeSend(ws, { type: 'hello', room });
  if (lastValue.has(room)) {
    safeSend(ws, { type: 'state', value: lastValue.get(room), room });
  }

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch (e) {
      console.warn('[WS] JSON parse error:', e);
      return;
    }

    // Normalizamos: aceptamos {type:"slider", value} o {type:"state", value}
    const t = (msg.type || '').toString().toLowerCase();
    if (t === 'slider' || t === 'state') {
      const value = clamp01(msg.value);
      lastValue.set(room, value);

      // Enviamos como "state" a todos MENOS al emisor
      const payload = { type: 'state', value, room };
      broadcastToRoom(room, payload, ws);
      return;
    }

    if (t === 'ping') {
      safeSend(ws, { type: 'pong', room });
      return;
    }

    // Ignora otros tipos silenciosamente
  });

  ws.on('close', () => {
    removeFromRoom(room, ws);
    console.log(`[WS] - client left room="${room}" (remaining ${rooms.get(room)?.size || 0})`);
  });
});

// --- Arranque ----------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`HTTP on :${PORT}`);
  console.log(`WS   on :${PORT}/ws  (use wss://YOUR-RENDER.onrender.com/ws?room=miSala)`);
});
