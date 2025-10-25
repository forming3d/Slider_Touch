// server.js — Express + WebSocket (rooms) + static + /new
"use strict";
const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
app.use(express.static(__dirname, { extensions: ["html"] }));

function slug() {
  const a = ["sol","luna","zen","norte","sur","rojo","verde","magno","alto","brisa"];
  const b = ["rio","cima","valle","delta","nube","pico","puente","eco","rayo","nodo"];
  const s = arr => arr[Math.floor(Math.random()*arr.length)];
  const suf = Math.random().toString(36).slice(2,5);
  return `${s(a)}-${s(b)}-${suf}`;
}

app.get("/new", (_req, res) => res.redirect(`/Slider.html?room=${slug()}`));
app.get("/",    (_req, res) => res.sendFile(path.join(__dirname, "montest.html")));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function getRoomFromReq(urlStr) {
  try {
    const u = new URL(urlStr, "http://x");
    if (u.pathname !== "/ws") return null;
    return (u.searchParams.get("room") || "default").trim() || "default";
  } catch { return "default"; }
}

wss.on("connection", (ws, req) => {
  const room = getRoomFromReq(req.url) || "default";
  ws.room = room;
  ws.isAlive = true;

  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (buf) => {
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === 1 && client.room === room) {
        client.send(buf.toString());
      }
    }
  });
});

const iv = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30000);

wss.on("close", () => clearInterval(iv));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP+WS listo: http://localhost:${PORT}  (WS: /ws, NEW: /new)`);
});
