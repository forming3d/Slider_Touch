// Slider_app.js — rooms + ejemplo TD dinámico + reconexión simple

// --- utilidades URL/room ---
const qs = new URLSearchParams(location.search);

function randomRoom() {
  const adjs = ['sol','luna','zen','norte','sur','rojo','verde','magno','alto','brisa'];
  const subs = ['rio','cima','valle','delta','nube','pico','puente','eco','rayo','nodo'];
  const a = adjs[Math.floor(Math.random()*adjs.length)];
  const s = subs[Math.floor(Math.random()*subs.length)];
  const suf = Math.random().toString(36).slice(2,5);
  return `${a}-${s}-${suf}`;
}

const room = (qs.get('room') || '').trim() || randomRoom();
if (!qs.get('room')) {
  const u = new URL(location.href);
  u.searchParams.set('room', room);
  history.replaceState({}, '', u.toString());
}

// ws base (de ?ws= o por defecto mismo host /ws)
const wsBase = (qs.get('ws') || '').trim() ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

// URL final de conexión
const wsURL = `${wsBase}?room=${encodeURIComponent(room)}`;

// pinta cabecera y ejemplos
document.getElementById('roomLabel').textContent = `Sala: ${room}`;
const exTD  = document.getElementById('exTD');
const exAlt = document.getElementById('exAlt');
if (exTD)  exTD.textContent  = wsURL;                          // wss://host/ws?room=xxx
if (exAlt) exAlt.textContent = `?ws=${encodeURIComponent(wsBase)}&room=${room}`;

// botón “Copiar enlace”
document.getElementById('copyLink')?.addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('room', room);
  if (qs.has('ws')) url.searchParams.set('ws', wsBase);
  try {
    await navigator.clipboard.writeText(url.toString());
    const btn = document.getElementById('copyLink');
    const old = btn.textContent;
    btn.textContent = '¡Copiado!';
    setTimeout(() => (btn.textContent = old), 1200);
  } catch {
    alert(url.toString());
  }
});

// UI slider
const slider = document.getElementById('slider');
const valueBox = document.getElementById('value');
function setValueUI(v) {
  const pct = Math.round(v * 100);
  valueBox.textContent = `${pct}%`;
  slider.value = v;
}

// conexión WebSocket (reconexión simple)
let ws, reconnectTimer;
function connect() {
  clearTimeout(reconnectTimer);
  ws = new WebSocket(wsURL);
  ws.addEventListener('open', () => {
    sendState(parseFloat(slider.value));      // estado inicial
  });
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state' && typeof msg.value === 'number') {
        setValueUI(Math.max(0, Math.min(1, msg.value)));
      }
    } catch {}
  });
  ws.addEventListener('close', () => {
    reconnectTimer = setTimeout(connect, 1000);
  });
}
connect();

function sendState(v) {
  const msg = { type: 'state', room, value: v };
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

// throttling
let lastSend = 0;
slider.addEventListener('input', () => {
  const now = performance.now();
  const v = parseFloat(slider.value);
  setValueUI(v);
  if (now - lastSend > 30) {
    lastSend = now;
    sendState(v);
  }
});
