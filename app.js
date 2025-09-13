// === Config ===
// 1) Pon aquí el host del túnel (Cloudflare/Ngrok) SIN ruta. Ej: wss://abcde.trycloudflare.com
const WS_URL = (new URLSearchParams(location.search)).get('ws') || 'wss://<TU-HOST>.trycloudflare.com';
// 2) Token que debe coincidir con el del callback en TD
const TOKEN = (new URLSearchParams(location.search)).get('token') || 'cambia-este-token';
// 3) Ruta opcional del websocket (TD Web Server DAT no requiere ruta fija, pero dejamos /ws)
const WS_PATH = '/ws';

const range = document.getElementById('range');
const out = document.getElementById('out');
const statusEl = document.getElementById('status');

let ws = null;
let reconnectMs = 1000;
let rafPending = false;

function fmt(v) { return Number(v).toFixed(3); }

function setStatus(t) { statusEl.textContent = t; }

// Throttle (máx ~60Hz usando rAF)
function sendSlider() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const payload = JSON.stringify({ type: 'slider', value: Number(range.value), token: TOKEN });
  ws.send(payload); // MDN WebSocket.send() :contentReference[oaicite:10]{index=10}
}

function scheduleSend() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    sendSlider();
  });
}

function connect() {
  try {
    const url = `${WS_URL}${WS_PATH}`;
    ws = new WebSocket(url); // API estándar WebSocket en navegadores :contentReference[oaicite:11]{index=11}
  } catch (e) {
    setStatus('URL de WebSocket inválida');
    return;
  }

  ws.onopen = () => {
    setStatus('Conectado');
    reconnectMs = 1000;
    // Enviar el valor inicial
    scheduleSend();
  };

  ws.onmessage = (ev) => {
    // Esperamos mensajes JSON: {"type":"state","value":0.123}
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state' && typeof msg.value === 'number') {
        range.value = msg.value;
        out.value = fmt(msg.value);
      }
    } catch (_) { }
  };

  ws.onclose = () => {
    setStatus('Desconectado. Reintentando...');
    setTimeout(connect, reconnectMs);
    reconnectMs = Math.min(reconnectMs * 1.8, 15000);
  };

  ws.onerror = () => {
    // se gestionará con onclose
  };
}

// UI
range.addEventListener('input', () => {
  out.value = fmt(range.value);
  scheduleSend();
});

// Start
out.value = fmt(range.value);
setStatus('Conectando...');
connect();
