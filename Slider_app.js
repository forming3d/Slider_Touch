// Slider_app.js
(function () {
  // ---- genera un slug legible (palabra-palabra-xxx)
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function makeSlug() {
    const A = ['luna','sol','nube','pixel','neon','eco','mar','rio','zen','nova','quark','cromo','onda','vapor','laser'];
    const B = ['rojo','azul','verde','negro','blanco','magno','turbo','kappa','alpha','omega','gamma','delta','sigma'];
    const tail = Math.random().toString(36).slice(2, 5);
    return `${pick(A)}-${pick(B)}-${tail}`;
  }

  // ---- ROOM desde URL; si falta, crea una y reescribe la URL sin recargar
  const params = new URLSearchParams(window.location.search);
  let ROOM = params.get('room') || params.get('r');
  if (!ROOM) {
    ROOM = makeSlug();
    params.set('room', ROOM);
    // conserva ?ws=... si venía
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  }

  // ---- Construye la URL del WS (permite ?ws=... en la URL)
  const custom = params.get('ws');
  function buildWsUrl() {
    try {
      if (custom) {
        const u = new URL(custom);
        if (!u.searchParams.has('room')) u.searchParams.set('room', ROOM);
        return u.toString();
      }
    } catch {}
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
  const copyBtn = document.getElementById('copyLink');

  if (roomLabel) roomLabel.textContent = `Sala: ${ROOM}`;
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        copyBtn.textContent = 'Copiado ✓';
        setTimeout(() => (copyBtn.textContent = 'Copiar enlace'), 1200);
      } catch {}
    });
  }

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

  // ---- WS con reconexión y join a la sala
  let ws = null, retry = null;
  function connect() {
    try { ws = new WebSocket(WS_URL); } catch { retry = setTimeout(connect, 1500); return; }

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', room: ROOM }));
      const v = clamp01(range.value);
      ws.send(JSON.stringify({ type: 'state', value: v, room: ROOM }));
    };

    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m && typeof m.room === 'string' && m.room !== ROOM) return;
        if ((m.type === 'state' || m.type === 'slider') && typeof m.value === 'number') {
          const v = clamp01(m.value);
          range.value = String(v);
          localStorage.setItem(KEY, String(v));
          setBubble(v);
          setFillFromValue(v);
        }
      } catch {}
    };

    ws.onclose = () => { retry = setTimeout(connect, 1500); };
  }
  connect();

  // ---- Input local -> broadcast
  range.addEventListener('input', () => {
    const v = clamp01(range.value);
    localStorage.setItem(KEY, String(v));
    setBubble(v);
    setFillFromValue(v);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'slider', value: v, room: ROOM }));
    }
  });
})();
