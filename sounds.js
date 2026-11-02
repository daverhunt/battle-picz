/* Small, self-contained Web Audio effects. Audio is unlocked by a player gesture. */
(function () {
  let context, master, paused = false;
  const voices = new Set(), last = new Map();
  const enabled = () => { try { return window.battlePiczPreferences?.soundEnabled !== false; } catch { return true; } };
  function stop() {
    for (const voice of voices) { try { voice.stop(); } catch {} }
    voices.clear();
  }
  function unlock() {
    if (!enabled() || document.hidden) return;
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        master = context.createGain();
        master.gain.value = 0.16;
        master.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Unsupported or blocked audio never interrupts gameplay. */ }
  }
  function tone(frequency, delay = 0, duration = 0.1, type = 'sine', end = frequency) {
    const osc = context.createOscillator(), gain = context.createGain();
    const at = context.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.45, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain); gain.connect(master);
    voices.add(osc);
    osc.onended = () => { voices.delete(osc); osc.disconnect(); gain.disconnect(); };
    osc.start(at); osc.stop(at + duration + 0.02);
  }
  function play(name) {
    if (!enabled() || paused || document.hidden || !context || context.state !== 'running') return;
    const now = performance.now();
    if (now - (last.get(name) ?? -Infinity) < (name === 'warning' ? 900 : 65)) return;
    last.set(name, now);
    if (voices.size > 10) return;
    try {
      switch (name) {
        case 'tile': tone(420 + Math.random() * 65, 0, .07, 'sine', 160); break;
        case 'letter': tone(650, 0, .045, 'sine', 480); break;
        case 'delete': tone(360, 0, .055, 'sine', 220); break;
        case 'correct': [660, 830, 990].forEach((n,i) => tone(n,i*.09,.18)); break;
        case 'wrong': [230, 185].forEach((n,i) => tone(n,i*.1,.1)); break;
        case 'tick': tone(560,0,.06); break;
        case 'start': tone(880,0,.17); break;
        case 'bomb': tone(150,0,.26,'triangle',35); break;
        case 'remove': tone(900,0,.18,'sine',180); break;
        case 'reveal': [800,1200,1600].forEach((n,i) => tone(n,i*.055,.12)); break;
        case 'skip': tone(260,0,.15,'sine',900); break;
        case 'warning': tone(720,0,.045); break;
        case 'won': [523,659,784,1047].forEach((n,i) => tone(n,i*.12,.22)); break;
        case 'lost': [392,330,262].forEach((n,i) => tone(n,i*.14,.2)); break;
        case 'draw': [440,523].forEach((n,i) => tone(n,i*.12,.18)); break;
      }
    } catch { stop(); }
  }
  window.battlePiczSound = { play, unlock, stop, setPaused(value) { paused = Boolean(value); if (paused) stop(); } };
  document.addEventListener('pointerdown', unlock, {capture:true, passive:true});
  document.addEventListener('keydown', unlock, {capture:true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stop(); if (context?.state === 'running') context.suspend().catch(() => {}); }
    else if (context) unlock();
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('battle-picz:settings-changed', () => { if (!enabled()) stop(); else unlock(); });
})();
