// Slider_app.js — rooms + estado conexión + anti-eco + copia WSS

// -------- Helpers --------
function randomRoom() {
  const A = ['sol','luna','zen','norte','sur','rojo','verde','magno','alto','brisa'];
  const B = ['rio','cima','valle','delta','nube','pico','puente','eco','rayo','nodo'];
  const a = A[Math.floor(Math.random()*A.length)];
  const b = B[Math.floor(Math.random()*B.length)];
  const s = Math.random().toString(36).slice(2,5);
  return `${a}-${b}-${s}`;
}
function clamp01(x){ x = Number(x); return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; }

const qs = new URLSearchParams(location.search);
const room = (qs.get('room') || '').trim() || randomRoom();
if (!qs.get('room')) {
  const u = new URL(location.href); u.searchParams.set('room', room);
  history.replaceState({}, '', u.toString());
}
const wsBase = (qs.get('ws') || '').trim() ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

function wsUrlForRoom(r) {
  const base = qs.get('ws') ? qs.get('ws') : wsBase;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}room=${encodeURIComponent(r)}`;
}
function pageUrlForRoom(r) {
  return `${location.origin}/Slider.html?room=${encodeURIComponent(r)}`;
}

// -------- UI refs --------
const roomLabel  = document.getElementById('roomLabel');
const copyBtn    = document.getElementById('copyLink');
const exTD       = document.getElementById('exTD');
const exAlt      = document.getElementById('exAlt');
const slider     = document.getElementById('slider');     // range 0..1 step=0.001
const valueBox   = document.getElementById('value');      // % text
const dot        = document.getElementById('dot');
const statusText = document.getElementById('statusText');

if (roomLabel) roomLabel.textContent = `Sala: ${room}`;
if (exTD)  exTD.textContent  = wsUrlForRoom(room);
if (exAlt) exAlt.textContent = `?ws=${encodeURIComponent(wsBase)}&room=${room}`;
if (copyBtn) copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(wsUrlForRoom(room));
    const t = copyBtn.textContent; copyBtn.textContent = '¡Copiado WSS!';
    setTimeout(() => (copyBtn.textContent = t), 1200);
  } catch { alert(wsUrlForRoom(room)); }
});

function setUI(v01){
  const v = clamp01(v01);
  if (slider) slider.value = String(v);
  if (valueBox) valueBox.textContent = `${Math.round(v*100)}%`;
}
function setStatus(ok, text){
  if (statusText && text) statusText.textContent = text;
  if (!dot) return;
  if (ok) dot.classList.add('ok'); else dot.classList.remove('ok');
}

// -------- WS (reconexión + anti-eco) --------
let ws, reconnectTimer, rx = false, isDragging = false;
const senderId = 'web-' + Math.random().toString(36).slice(2);

const wsURL = wsUrlForRoom(room);
function connect(){
  clearTimeout(reconnectTimer);
  setStatus(false, 'Conectando…');
  ws = new WebSocket(wsURL);

  ws.addEventListener('open', () => {
    setStatus(true, 'Conectado');
    // anunciar estado inicial
    const v = clamp01(Number(slider?.value ?? 0));
    sendState(v);
  });

  ws.addEventListener('message', (ev) => {
    try {
      const m = JSON.parse(ev.data);
      // ignora mi propio rebote
      if (m.sender && m.sender === senderId) return;

      if ((m.type === 'state' || m.type === 'slider') && typeof m.value === 'number') {
        rx = true;                 // anti-eco: no enviar durante actualización remota
        if (!isDragging) setUI(m.value);
        rx = false;
      }
    } catch {}
  });

  ws.addEventListener('close', () => {
    setStatus(false, 'Reconectando…');
    reconnectTimer = setTimeout(connect, 1000);
  });
  ws.addEventListener('error', () => {
    setStatus(false, 'Error de conexión');
  });
}
connect();

function sendState(v01){
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'state', room, value: clamp01(v01), sender: senderId }));
  }
}

// -------- Eventos UI --------
let lastSend = 0;
if (slider) {
  slider.addEventListener('input', () => {
    isDragging = true;
    const v = clamp01(Number(slider.value));
    setUI(v);
    if (rx) return;                      // no emitir si estoy aplicando remoto
    const now = performance.now();
    if (now - lastSend > 30) { lastSend = now; sendState(v); }
  });
  slider.addEventListener('change', () => { isDragging = false; });
}
