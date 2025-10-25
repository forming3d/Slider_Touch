// Slider_app.js
(function () {
  // ---- ROOM desde URL (?room=xxx o ?r=xxx)
  const params = new URLSearchParams(window.location.search);
  const ROOM = params.get('room') || params.get('r') || 'default';

  // ---- Construye la URL del WS
  // Puedes pasar ?ws=wss://mi-servidor/ws en la URL para forzar destino.
  const custom = params.get('ws');
  function buildWsUrl() {
    try {
      if (custom) {
        const u = new URL(custom);
        if (!u.searchParams.has('room')) u.searchParams.set('room', ROOM);
        return u.toString();
      }
    } catch { }
    const base =
      location.hostname === 'localhost'
        ? 'ws://localhost:3000/ws'
        : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const u = new URL(base);
    u.searchParams.set('room', ROOM);
    return u.toString();
  }
  const WS_URL = buildWsUrl();

  // ---- DOM
  const range = document.getElementById('slider');
  const bubble = document.getElementById('value');
  const roomLabel = document.getElementById('roomLabel');

  if (roomLabel) roomLabel.textContent = `Sala: ${ROOM}`;

  function clamp01(x) { x = Number(x); return isFinite(x) ? Math.min(1, Math.max(0, x)) : 0; }
  function setBubble(v) { bubble.textContent = (v * 100).toFixed(0) + '%'; }
  function setFillFromValue(v) {
    const p = (v * 100).toFixed(2) + '%';
    range.style.background = `linear-gradient(90deg, #22c55e ${p}, #1f2937 ${p})`;
  }

  const KEY = 'slider.value.' + ROOM;
  const saved = clamp01(localStorage.getItem(KEY));
  range.value = String(saved);
  setBubble(saved);
  setFillFromValue(saved);

  // ---- WS con reconexión
  let ws = null, retry = null;
  function connect() {
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      retry = setTimeout(connect, 1500);
      return;
    }

    ws.onopen = () => {
      // Une explícitamente a la sala (por si el servidor quiere cambiar room en runtime)
      ws.send(JSON.stringify({ type: 'join', room: ROOM }));
      // Al conectar, publica nuestro estado para sincronizar a otros clientes de la sala
      const v = clamp01(range.value);
      ws.send(JSON.stringify({ type: 'state', value: v, room: ROOM }));
    };

    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        // Ignora mensajes de otras salas (si llegaran)
        if (m && typeof m.room === 'string' && m.room !== ROOM) return;

        // Acepta 'state' y también 'slider' por compatibilidad
        if ((m.type === 'state' || m.type === 'slider') && typeof m.value === 'number') {
          const v = clamp01(m.value);
          range.value = String(v);
          localStorage.setItem(KEY, String(v));
          setBubble(v);
          setFillFromValue(v);
        }
      } catch { }
    };

    ws.onclose = () => {
      retry = setTimeout(connect, 1500);
    };
  }
  connect();

  // ---- Input local -> broadcast
  range.addEventListener('input', () => {
    const v = clamp01(range.value);
    localStorage.setItem(KEY, String(v));
    setBubble(v);
    setFillFromValue(v);
    if (ws && ws.readyState === 1) {
      // Mandamos 'slider' (el server lo normaliza a 'state') y añadimos room
      ws.send(JSON.stringify({ type: 'slider', value: v, room: ROOM }));
    }
  });
})();
