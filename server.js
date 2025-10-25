// server.js — Express + WebSocket, sin montest, con salas (?room=...)
const path = require("path");
const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();

// Servir archivos estáticos desde ESTE MISMO directorio:
// Asegúrate de tener aquí: Slider.html, Slider_app.js, Slider_styles.css, slider_animation.js
app.use(express.static(__dirname, { extensions: ["html"] }));

// ---------- util: nombre de sala legible-aleatorio ----------
function slug() {
  const a = ["sol", "luna", "zen", "norte", "sur", "rojo", "verde", "magno", "alto", "brisa"];
  const b = ["rio", "cima", "valle", "delta", "nube", "pico", "puente", "eco", "rayo", "nodo"];
  const s = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const suf = Math.random().toString(36).slice(2, 5);
  return `${s(a)}-${s(b)}-${suf}`;
}

// ---------- rutas HTTP ----------
app.get("/new", (_req, res) => {
  // redirige a una sala aleatoria
  res.redirect(`/Slider.html?room=${slug()}`);
});

// raíz: envía al slider (sin sala) o si prefieres, a /new
app.get("/", (_req, res) => res.redirect("/Slider.html")); // o: res.redirect("/new")

// healthcheck para Render
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---------- servidor HTTP + WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// extrae ?room= de la URL del handshake WS
function getRoomFromUrl(urlStr) {
  try {
    const u = new URL(urlStr, "http://x");
    if (u.pathname !== "/ws") return null; // sólo aceptamos /ws
    const room = (u.searchParams.get("room") || "default").trim();
    return room || "default";
  } catch {
    return "default";
  }
}

// broadcast por sala
wss.on("connection", (ws, req) => {
  ws.room = getRoomFromUrl(req.url) || "default";
  ws.isAlive = true;

  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (buf) => {
    for (const c of wss.clients) {
      if (c !== ws && c.readyState === 1 && c.room === ws.room) {
        c.send(buf.toString());
      }
    }
  });
});

// heartbeat para limpiar clientes caídos
const iv = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} ; continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30000);

wss.on("close", () => clearInterval(iv));

// ---------- start ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP en http://localhost:${PORT}`);
  console.log(`WS path: /ws  |  Ir a /new para sala aleatoria`);
});
