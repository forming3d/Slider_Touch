// Slider_app.js — rooms + copia de enlace WSS + reconexión + UI 0..1

// --------- Helpers ---------
function randomRoom() {
  const adjs = ['sol','luna','zen','norte','sur','rojo','verde','magno','alto','brisa'];
  const subs = ['rio','cima','valle','delta','nube','pico','puente','eco','rayo','nodo'];
  const a = adjs[Math.floor(Math.random()*adjs.length)];
  const s = subs[Math.floor(Math.random()*subs.length)];
  const suf = Math.random().toString(36).slice(2,5);
  return `${a}-${s}-${suf}`;
}

const qs = new URLSearchParams(location.search);

// Si no hay ?room= generamos uno y lo fijamos en la URL (sin recargar)
const room = (qs.get('room') || '').trim() || randomRoom();
if (!qs.get('room')) {
  const u = new URL(location.href);
  u.searchParams.set('room', room);
  history.replaceState({}, '', u.toString());
}

// base WS: puede venir de ?ws= o usar el mismo host (/ws)
const wsBase = (qs.get('ws') || '').trim() ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

function wsUrlForRoom(r) {
  // Si ?ws= venía con path completo (wss://otro-host/ws), sólo añadimos ?room=
  const base = qs.get('ws') ? qs.get('ws') : wsBase;
  const hasQuery = base.includes('?');
  return `${base}${hasQuery ? '&' : '?'}room=${encodeURIComponent(r)}`;
}

function pageUrlForRoom(r) {
  return `${location.origin}/Slider.html?room=${encodeURIComponent(r)}`;
}

// --------- UI refs ---------
const roomLabel = document.getElementById('roomLabel');
const copyBtn   = document.getElementById('copyLink');
const exTD      = document.getElementById('exTD');   // línea “En TouchDesigner usa: …”
const exAlt     = document.getElementById('exAlt');  // sugerencia de ?ws=...
const slider    = document.getElementById('slider'); // <input type="range" min="0" max="1" step="0.001">
const valueBox  = document.getElementById('value');  // % mostrado

if (roomLabel) roomLabel.textContent = `Sala: ${room}`;
if (exTD)  exTD.textContent  = wsUrlForRoom(room);
if (exAlt) exAlt.textContent = `?ws=${encodeURIComponent(wsBase)}&room=${room}`;

if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(wsUrlForRoom(room)); // <- copia WSS
      const old = copyBtn.textContent;
      copyBtn.textContent = '¡Copiado WSS!';
      setTimeout(() => (copyBtn.textContent = old), 1200);
    } catch (e) {
      alert(wsUrlForRoom(room)); // fallback
    }
  });
}

function clamp01(x){ x = Number(x); return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; }
function setValueUI(v01){
  const v = clamp01(v01);
  if (slider)  slider.value = String(v);
  if (valueBox) valueBox.textContent = `${Math.round(v*100)}%`;
}

// --------- WebSocket ---------
let ws, reconnectTimer;
const wsURL = wsUrlForRoom(room);
let isDragging = false; // para no pisar al usuario mientras arrastra

function connect() {
  clearTimeout(reconnectTimer);
  ws = new WebSocket(wsURL);

  ws.addEventListener('open', () => {
    // envía tu estado inicial (type:'state'); el server acepta state/slider
    const v = clamp01(Number(slider?.value ?? 0));
    sendState(v);
  });

  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if ((msg.type === 'state' || msg.type === 'slider') && typeof msg.value === 'number') {
        if (!isDragging) setValueUI(msg.value); // evita pelear con arrastre local
      }
    } catch {}
  });

  ws.addEventListener('close', () => {
    reconnectTimer = setTimeout(connect, 1000);
  });
}

function sendState(v01) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'state', room, value: clamp01(v01) }));
  }
}

connect();

// --------- Eventos UI ---------
let lastSend = 0;
if (slider) {
  slider.addEventListener('input', () => {
    isDragging = true;
    const v = clamp01(Number(slider.value));
    setValueUI(v);
    const now = performance.now();
    if (now - lastSend > 30) {
      lastSend = now;
      sendState(v);
    }
  });
  slider.addEventListener('change', () => { isDragging = false; });
}

// --------- (Opcional) mostrar enlace de página con sala, por si lo necesitas en otra parte ---------
// const pageLink = document.getElementById('pageLink');
// if (pageLink) pageLink.textContent = pageUrlForRoom(room);
