// HTTP + WebSocket en el MISMO puerto (compatible Render/Fly/NGINX)
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Health-check opcional
app.get('/', (_, res) => res.send('WS OK'));

// Keep-alive + broadcast simple
function heartbeat() { this.isAlive = true; }
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', (buf) => {
    // Reenvía a TODOS (navegadores y TD)
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(buf);
    }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('WS up on :' + PORT));
