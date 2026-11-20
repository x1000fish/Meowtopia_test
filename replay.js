(() => {
  const match = location.pathname.match(/level(\d+)\.html$/i);
  if (!match) return;
  const level = Number(match[1]);
  const events = [];
  let saved = false;
  let visualLayout = null;
  const visualLayouts = {};

  function imageGeometry(parent) {
    const parentRect = parent.getBoundingClientRect();
    const innerLeft = parentRect.left + parent.clientLeft;
    const innerTop = parentRect.top + parent.clientTop;
    const innerWidth = parent.clientWidth || parentRect.width;
    const innerHeight = parent.clientHeight || parentRect.height;
    return Array.from(parent.querySelectorAll(':scope > img')).map(image => {
      const rect = image.getBoundingClientRect();
      return {
        src: image.getAttribute('src') || image.src,
        alt: image.alt || '',
        x: innerWidth ? (rect.left - innerLeft) / innerWidth : 0,
        y: innerHeight ? (rect.top - innerTop) / innerHeight : 0,
        w: innerWidth ? rect.width / innerWidth : 0.8,
        h: innerHeight ? rect.height / innerHeight : 0.8,
        z: Number(getComputedStyle(image).zIndex) || 1,
        filter: getComputedStyle(image).filter,
        opacity: Number(getComputedStyle(image).opacity)
      };
    });
  }

  function captureVisualLayout(fishState) {
    const canvas = document.querySelector('.game-canvas');
    if (!canvas) return null;
    const canvasRect = canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return null;
    const nodeElements = Array.from(document.querySelectorAll('.cat-node, .node[id^="node-"]'))
      .sort((a, b) => Number(a.id.match(/\d+$/)?.[0] || 0) - Number(b.id.match(/\d+$/)?.[0] || 0));
    const fishElements = Array.from(document.querySelectorAll('.fish-wrapper[id^="fish"], .fish-wrapper[id^="fish-wrap-"]'))
      .sort((a, b) => Number(a.id.match(/\d+$/)?.[0] || 0) - Number(b.id.match(/\d+$/)?.[0] || 0));
    const nodes = nodeElements.map((node, index) => {
      const rect = node.getBoundingClientRect();
      return {
        id: index,
        large: node.classList.contains('large-node'),
        x: (rect.left - canvasRect.left) / canvasRect.width,
        y: (rect.top - canvasRect.top) / canvasRect.height,
        w: rect.width / canvasRect.width,
        h: rect.height / canvasRect.height,
        border: parseFloat(getComputedStyle(node).borderTopWidth) || 0,
        images: imageGeometry(node)
      };
    });
    const fishes = fishElements.map((fish, index) => {
      const style = getComputedStyle(fish);
      const matrix = style.transform.match(/^matrix\(([^)]+)\)$/);
      const values = matrix ? matrix[1].split(',').map(Number) : [];
      const isCentered = values.length === 6 && Math.abs(values[4] + fish.offsetWidth / 2) < 2 && Math.abs(values[5] + fish.offsetHeight / 2) < 2;
      return {
        id: Number(fish.id.match(/\d+$/)?.[0] || index),
        w: fish.offsetWidth / canvasRect.width,
        h: fish.offsetHeight / canvasRect.height,
        center: isCentered,
        images: imageGeometry(fish)
      };
    });
    const anchors = {};
    if (Array.isArray(fishState)) {
      fishElements.forEach((fish, fishId) => {
        const id = Number(fish.id.match(/\d+$/)?.[0] || fishId);
        const nodeId = level >= 9 ? fishState.indexOf(id) : Number(fishState[id]);
        const node = nodes[nodeId];
        if (!node || nodeId < 0) return;
        anchors[nodeId] = {
          x: (canvas.clientLeft + fish.offsetLeft) / (canvasRect.width || 1) - (node.x + node.w / 2),
          y: (canvas.clientTop + fish.offsetTop) / (canvasRect.height || 1) - (node.y + node.h / 2)
        };
      });
    }
    return { width: canvasRect.width, height: canvasRect.height, nodes, fishes, anchors };
  }

  function readGlobal(expression, fallback) {
    try { return (0, eval)(expression); } catch (_) { return fallback; }
  }
  function snapshot() {
    const fish = readGlobal('fishAtNode', null);
    const gates = readGlobal('gateHistory', null);
    const rawSkin = readGlobal('currentSkin', 'default');
    const skin = ['default', 'rip', 'poto', 'mj'].includes(rawSkin) ? rawSkin : 'default';
    const count = readGlobal('steps', readGlobal('currentSteps', events.length));
    const parts = [];
    if (Number.isFinite(Number(count))) parts.push(`Moves: ${Number(count)}`);
    if (Array.isArray(fish)) parts.push(`Cat positions: ${fish.map((p, i) => `${i + 1} → ${Number(p) + 1}`).join(', ')}`);
    if (Array.isArray(gates)) parts.push(`Circuit: ${gates.length ? gates.join(' → ') : '(empty)'}`);
    if (!visualLayouts[skin]) visualLayouts[skin] = captureVisualLayout(fish);
    visualLayout = visualLayouts[skin] || visualLayout;
    return {
      text: parts.join('\n') || 'Puzzle state updated',
      fishAtNode: Array.isArray(fish) ? fish.map(Number) : null,
      skin
    };
  }
  function capture() {
    const state = snapshot();
    if (events.length && events[events.length - 1].text === state.text && events[events.length - 1].skin === state.skin) return;
    events.push(state);
    if (events.length > 60) events.shift();
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
    const endpoint = 'https://script.google.com/macros/s/AKfycbzAwPg4Bf5V2sZ-E-wmstI3FBHwlynIlMLStQwlbs9cbJY2Zof_PTZZHRa43ob26SbiPw/exec';
    try {
      await fetch(endpoint, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: 'saveReplay', token, level, steps: stepCount, time: elapsed, replay: { version: 3, layouts: visualLayouts, events } })
      });
    } catch (_) { /* Completion remains playable even if replay sync is unavailable. */ }
  }

  const originalCapture = () => capture();
  if (typeof window.finishMove === 'function') {
    const original = window.finishMove;
    window.finishMove = function (...args) { const result = original.apply(this, args); originalCapture(); return result; };
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
