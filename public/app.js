// ── State ────────────────────────────────────────────────
let currentGameId = null;
let currentModel  = null;

const platform = detectPlatform();

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadModels();

  // If arriving from a "Fork & Edit" redirect, load the forked game
  const params = new URLSearchParams(window.location.search);
  const forkedId = params.get('gameId');
  if (forkedId) {
    currentGameId = forkedId;
    showGame(forkedId);
    setStatus('Forked game loaded. Refine it below.', 'success');
    // Clean the URL without reloading
    history.replaceState({}, '', '/');
  }
});

// ── Model picker ─────────────────────────────────────────
async function loadModels() {
  let models = [];
  try {
    const res = await fetch('/api/models');
    ({ models } = await res.json());
  } catch {
    setStatus('Could not load models. Is the server running?', 'error');
    return;
  }

  if (!models.length) {
    setStatus('No models available. Set at least one API key in .env.', 'error');
    return;
  }

  for (const select of ['model-select', 'refine-model-select']) {
    const el = document.getElementById(select);
    el.innerHTML = '';
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      if (m.default) opt.selected = true;
      el.appendChild(opt);
    }
  }

  currentModel = models.find(m => m.default)?.id ?? models[0].id;

  document.getElementById('model-select').addEventListener('change', (e) => {
    currentModel = e.target.value;
  });
  document.getElementById('refine-model-select').addEventListener('change', (e) => {
    currentModel = e.target.value;
  });
}

// ── Generate ─────────────────────────────────────────────
async function generateGame() {
  const description = document.getElementById('description').value.trim();
  if (!description) { setStatus('Please enter a game description.', 'error'); return; }

  setLoading(true, 'Generating game…');

  let data;
  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, platform, model: currentModel }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
  } catch (err) {
    setLoading(false);
    setStatus(err.message, 'error');
    return;
  }

  currentGameId = data.id;
  showGame(data.id);
  setLoading(false);
  setStatus(`Game generated with ${data.model}.`, 'success');
}

// ── Refine ───────────────────────────────────────────────
async function refineGame() {
  if (!currentGameId) { setStatus('Generate a game first.', 'error'); return; }

  const instruction = document.getElementById('refinement').value.trim();
  if (!instruction) { setStatus('Enter a refinement instruction.', 'error'); return; }

  setLoading(true, 'Refining game…');

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
    setLoading(false);
    setStatus(err.message, 'error');
    return;
  }

  currentGameId = data.id;
  showGame(data.id);
  document.getElementById('refinement').value = '';
  setLoading(false);
  setStatus(`Refined with ${data.model}.`, 'success');
}

// ── Share ────────────────────────────────────────────────
async function shareGame() {
  if (!currentGameId) { setStatus('Generate a game first.', 'error'); return; }

  let data;
  try {
    const res = await fetch(`/api/games/${currentGameId}/share`, { method: 'POST' });
    data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
  } catch (err) {
    setStatus(err.message, 'error');
    return;
  }

  await navigator.clipboard.writeText(data.url).catch(() => {});
  setStatus(`Share link copied: ${data.url}`, 'success');
}

// ── Helpers ──────────────────────────────────────────────
function showGame(gameId) {
  document.getElementById('game-frame').src = `/api/games/${gameId}/frame`;
  document.getElementById('game-section').classList.add('visible');
  document.getElementById('action-bar').classList.add('visible');
}

function setLoading(on, msg = '') {
  const btn = document.getElementById('generate-btn');
  btn.disabled = on;
  document.querySelectorAll('#action-bar button').forEach(b => b.disabled = on);
  if (on) {
    btn.innerHTML = '<span class="spinner"></span> ' + msg;
    setStatus(msg, 'loading');
  } else {
    btn.innerHTML = '▶ Generate Game';
  }
}

function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = type ? `status-${type}` : '';
}

function detectPlatform() {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768
    ? 'mobile'
    : 'desktop';
}
