let currentGameId = null;
let currentModel  = null;
let pendingFork   = false; // true when opened via share link — fork before first refine

const platform = detectPlatform();

document.addEventListener('DOMContentLoaded', async () => {
  const gameId = window.location.pathname.slice('/game/'.length);
  if (!gameId) return setStatus('Invalid URL.', 'error');

  pendingFork = new URLSearchParams(window.location.search).has('share');

  let data;
  try {
    const res = await fetch(`/api/games/${gameId}`);
    if (!res.ok) throw new Error('Game not found.');
    data = await res.json();
  } catch (err) {
    return setStatus(err.message, 'error');
  }

  currentGameId = gameId;
  renderPrompts(data.prompts ?? []);

  if (pendingFork) {
    // Share defaults: prompts open, game closed
    document.getElementById('prompts-details').open = true;
    document.getElementById('game-details').open = false;
  } else {
    document.getElementById('game-frame').src = `/api/games/${gameId}/frame`;
  }

  // Toggling game closed clears the iframe (stops the game);
  // toggling it open reloads it (restarts the game).
  document.getElementById('game-details').addEventListener('toggle', (e) => {
    const frame = document.getElementById('game-frame');
    if (e.target.open) {
      frame.src = `/api/games/${currentGameId}/frame`;
    } else {
      frame.src = 'about:blank';
    }
  });

  await loadModels();
  document.getElementById('action-bar').classList.add('visible');
});

// ── Actions ───────────────────────────────────────────────
async function refineGame() {
  const instruction = document.getElementById('refinement').value.trim();
  if (!instruction) { setStatus('Enter a refinement instruction.', 'error'); return; }

  setRefineLoading(true);

  // Auto-fork before the first edit of a shared game
  if (pendingFork) {
    try {
      const res = await fetch(`/api/games/${currentGameId}/fork`, { method: 'POST' });
      const fork = await res.json();
      if (!res.ok) throw new Error(fork.error ?? res.statusText);
      currentGameId = fork.id;
      pendingFork = false;
    } catch (err) {
      setRefineLoading(false);
      setStatus('Could not fork game: ' + err.message, 'error');
      return;
    }
  }

  let data;
  try {
    const res = await fetch(`/api/games/${currentGameId}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction, model: currentModel }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
  } catch (err) {
    setRefineLoading(false);
    setStatus(err.message, 'error');
    return;
  }

  currentGameId = data.id;
  history.pushState({}, '', `/game/${data.id}`);

  addPrompt(instruction);
  document.getElementById('game-details').open = true;
  document.getElementById('game-frame').src = `/api/games/${data.id}/frame`;
  document.getElementById('refinement').value = '';
  setRefineLoading(false);
  setStatus(`Refined with ${data.model}.`, 'success');
  document.getElementById('game-details').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function shareGame() {
  let data;
  try {
    const res = await fetch(`/api/games/${currentGameId}/share`, { method: 'POST' });
    data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
  } catch (err) {
    return setStatus(err.message, 'error');
  }
  await navigator.clipboard.writeText(data.url).catch(() => {});
  setStatus(`Share link copied: ${data.url}`, 'success');
}

// ── Models ────────────────────────────────────────────────
async function loadModels() {
  let models = [];
  try {
    const res = await fetch('/api/models');
    ({ models } = await res.json());
  } catch {
    return;
  }
  const el = document.getElementById('refine-model-select');
  el.innerHTML = '';
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    if (m.default) opt.selected = true;
    el.appendChild(opt);
  }
  currentModel = models.find(m => m.default)?.id ?? models[0]?.id;
  el.addEventListener('change', (e) => { currentModel = e.target.value; });
}

// ── Prompts ───────────────────────────────────────────────
function renderPrompts(prompts) {
  const list = document.getElementById('prompts-list');
  list.innerHTML = '';
  prompts.forEach((p, i) => addPromptItem(list, p.content, i + 1));
}

function addPrompt(content) {
  const list = document.getElementById('prompts-list');
  addPromptItem(list, content, list.children.length + 1);
}

function addPromptItem(list, content, index) {
  const li = document.createElement('li');
  li.dataset.index = index;
  li.textContent = content;
  list.appendChild(li);
}

// ── Helpers ───────────────────────────────────────────────
function setRefineLoading(on) {
  document.querySelectorAll('#action-bar button').forEach(b => b.disabled = on);
  const btn = document.getElementById('refine-btn');
  btn.innerHTML = on ? '<span class="spinner"></span> Refining…' : '🔄 Refine';
}

function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = type ? `status-${type}` : '';
}

function detectPlatform() {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768
    ? 'mobile' : 'desktop';
}
