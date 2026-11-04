(() => {
  const match = location.pathname.match(/level(\d+)\.html$/i);
  if (!match) return;
  const level = Number(match[1]);
  const events = [];
  let saved = false;

  function readGlobal(expression, fallback) {
    try { return (0, eval)(expression); } catch (_) { return fallback; }
  }
  function snapshot() {
    const fish = readGlobal('fishAtNode', null);
    const gates = readGlobal('gateHistory', null);
    const skin = readGlobal('currentSkin', 'default');
    const count = readGlobal('steps', readGlobal('currentSteps', events.length));
    const parts = [];
    if (Number.isFinite(Number(count))) parts.push(`Moves: ${Number(count)}`);
    if (Array.isArray(fish)) parts.push(`Cat positions: ${fish.map((p, i) => `${i + 1} → ${Number(p) + 1}`).join(', ')}`);
    if (Array.isArray(gates)) parts.push(`Circuit: ${gates.length ? gates.join(' → ') : '(empty)'}`);
    return {
      text: parts.join('\n') || 'Puzzle state updated',
      fishAtNode: Array.isArray(fish) ? fish.map(Number) : null,
      skin: ['default', 'rip', 'poto', 'mj'].includes(skin) ? skin : 'default'
    };
  }
  function capture() {
    const state = snapshot();
    if (events.length && events[events.length - 1].text === state.text) return;
    events.push(state);
    if (events.length > 300) events.shift();
  }
  function isSolved() {
    if (readGlobal('isSolved', false) === true || readGlobal('isGameOver', false) === true) return true;
    const fish = readGlobal('fishAtNode', null);
    if (Array.isArray(fish) && fish.every((position, index) => Number(position) === index)) return true;
    const modal = document.getElementById('victoryModal');
    return !!modal && getComputedStyle(modal).display !== 'none';
  }
  async function save() {
    if (saved || !isSolved()) return;
    saved = true;
    capture();
    const token = sessionStorage.getItem('meowAuthToken') || localStorage.getItem('meowAuthToken');
    if (!token || sessionStorage.getItem('isGuest') === 'true') return;
    const stepCount = Number(readGlobal('steps', readGlobal('currentSteps', events.length))) || events.length;
    const elapsed = Number(document.getElementById('timer')?.innerText) || Number(readGlobal('time', 0)) || 0;
    const endpoint = 'https://script.google.com/macros/s/AKfycbw2E-nE5xSJhF2HFsHLS4_w9_QxJ8dqEnFlMqcS294tNHxIITfhr8uInRylcLk9rxSl6A/exec';
    try {
      await fetch(endpoint, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: 'saveReplay', token, level, steps: stepCount, time: elapsed, replay: { version: 1, events } })
      });
    } catch (_) { /* Completion remains playable even if replay sync is unavailable. */ }
  }

  const originalCapture = () => capture();
  if (typeof window.finishMove === 'function') {
    const original = window.finishMove;
    window.finishMove = function (...args) { originalCapture(); return original.apply(this, args); };
  }
  if (typeof window.swapFish === 'function') {
    const original = window.swapFish;
    window.swapFish = function (...args) { const result = original.apply(this, args); originalCapture(); return result; };
  }
  if (typeof window.checkWin === 'function') {
    const original = window.checkWin;
    window.checkWin = function (...args) {
      const result = original.apply(this, args);
      Promise.resolve(result).then(() => { if (isSolved()) save(); });
      return result;
    };
  }
  window.addEventListener('load', () => { capture(); setTimeout(() => { if (isSolved()) save(); }, 1000); }, { once: true });
})();
