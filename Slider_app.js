// Slider_app.js — rooms + ejemplo TD real + reconexión
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

const wsBase = (qs.get('ws') || '').trim() ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const wsURL = `${wsBase}?room=${encodeURIComponent(room)}`;

document.getElementById('roomLabel').textContent = `Sala: ${room}`;
const exTD  = document.getElementById('exTD');
const exAlt = document.getElementById('exAlt');
if (exTD)  exTD.textContent  = wsURL;
if (exAlt) exAlt.textContent = `?ws=${encodeURIComponent(wsBase)}&room=${room}`;

document.getElementById('copyLink')?.addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('room', room);
  if (qs.has('ws')) url.searchParams.set('ws', wsBase);
  try {
    await navigator.clipboard.writeText(url.toString());
    const b = document.getElementById('copyLink');
    const old = b.textContent;
    b.textContent = '¡Copiado!';
    setTimeout(() => (b.textContent = old), 1200);
  } catch { alert(url.toString()); }
});

const slider = document.getElementById('slider');
const valueBox = document.getElementById('value');
function setValueUI(v) {
  const pct = Math.round(v * 100);
  valueBox.textContent = `${pct}%`;
  slider.value = v;
}

let ws, reconnectTimer;
function connect() {
  clearTimeout(reconnectTimer);
  ws = new WebSocket(wsURL);
  ws.addEventListener('open', () => sendState(parseFloat(slider.value)));
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state' && typeof msg.value === 'number') {
        setValueUI(Math.max(0, Math.min(1, msg.value)));
      }
    } catch {}
  });
  ws.addEventListener('close', () => reconnectTimer = setTimeout(connect, 1000));
}
connect();

function sendState(v) {
  const msg = { type: 'state', room, value: v };
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

let lastSend = 0;
slider.addEventListener('input', () => {
  const now = performance.now();
  const v = parseFloat(slider.value);
  setValueUI(v);
  if (now - lastSend > 30) { lastSend = now; sendState(v); }
});
