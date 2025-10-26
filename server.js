// server.js — HTTP + WS con rooms, anti-eco y 'sender'
'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const url = require('url');

const PORT = process.env.PORT || 10000;

const app = express();
app.use(express.static(path.join(__dirname)));
app.get('/', (_req, res) => res.redirect('/Slider.html'));

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map();     // room -> Set<ws>
const lastValue = new Map(); // room -> number

function getRoom(req) {
  try {
    const u = url.parse(req.url, true);
    const r = (u.query?.room || 'default').toString().trim();
    return r || 'default';
  } catch {
    return 'default';
  }
}

function add(room, ws) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
}
function del(room, ws) {
  const set = rooms.get(room);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    rooms.delete(room);
    lastValue.delete(room);
  }
}

function clamp01(x) {
  const v = Number(x);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
function safeSend(ws, obj) {
  try { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); } catch {}
}
function broadcast(room, obj, exceptWs) {
  const set = rooms.get(room);
  if (!set) return;
  for (const c of set) {
    if (c === exceptWs) continue;          // **no eco al emisor**
    safeSend(c, obj);
  }
}

wss.on('connection', (ws, req) => {
  const room = getRoom(req);
  ws.__room = room;
  add(room, ws);

  // Saludo + estado actual (si existe)
  safeSend(ws, { type: 'hello', room });
  if (lastValue.has(room)) {
    safeSend(ws, { type: 'state', room, value: lastValue.get(room) });
  }

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }

    const t = (msg.type || '').toString().toLowerCase();
    if (t === 'slider' || t === 'state') {
      const v = clamp01(msg.value);
      const prev = lastValue.get(room);
      if (prev != null && Math.abs(prev - v) < 1e-4) return; // de-dupe
      lastValue.set(room, v);

      // Propagamos 'sender' si viene
      const out = { type: 'state', room, value: v };
      if (msg.sender) out.sender = msg.sender;

      broadcast(room, out, ws);             // **no** al emisor
      return;
    }

    if (t === 'ping') {
      safeSend(ws, { type: 'pong', room });
    }
  });

  ws.on('close', () => del(room, ws));
});

server.listen(PORT, () => {
  console.log(`HTTP :${PORT}  WS /ws`);
});
