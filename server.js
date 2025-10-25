// server.js — Express + WebSocket (rooms) + static + /new
// Ejecuta con: node server.js  (Render usará PORT)

"use strict";
const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

// ---------- App HTTP ----------
const app = express();

// Sirve todos los archivos del repo (Slider.html, montest.html, JS/CSS…)
app.use(express.static(__dirname, { extensions: ["html"] }));

// Pequeño generador de slug sala-xxxx
function slug() {
  const a = ["sol","luna","zen","norte","sur","rojo","verde","magno","alto","brisa"];
  const b = ["rio","cima","valle","delta","nube","pico","puente","eco","rayo","nodo"];
  const s = (arr) => arr[Math.floor(Math.random()*arr.length)];
  const suf = Math.random().toString(36).slice(2,5);
  return `${s(a)}-${s(b)}-${suf}`;
}

// /new -> redirige a Slider.html con sala aleatoria
app.get("/new", (_req, res) => {
  res.redirect(`/Slider.html?room=${slug()}`);
});

// Raíz -> abre montest.html (cámbialo si prefieres Slider.html)
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "montest.html"));
});

// Health check opcional
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---------- HTTP + WS ----------
const server = http.createServer(app);

// WS con rooms en la ruta /ws
const wss = new WebSocketServer({ server });

function getRoomFromReq(reqUrl) {
  try {
    const u = new URL(reqUrl, "http://x");
    if (u.pathname !== "/ws") return null;
    return (u.searchParams.get("room") || "default").trim() || "default";
  } catch {
    return "default";
  }
}

wss.on("connection", (ws, req) => {
  const room = getRoomFromReq(req.url) || "default";
  ws.room = room;
  ws.isAlive = true;

  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (buf) => {
    // Reenvía solo a los clientes de la misma sala
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === 1 && client.room === room) {
        client.send(buf.toString());
      }
    }
  });
});

// Ping/pong para mantener vivos los sockets
const iv = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30000);

wss.on("close", () => clearInterval(iv));

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP+WS en http://localhost:${PORT}  (WS -> /ws, NEW -> /new)`);
});
