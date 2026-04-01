let currentModel = null;

const platform = detectPlatform();

document.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
});

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

  const el = document.getElementById('model-select');
  el.innerHTML = '';
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    if (m.default) opt.selected = true;
    el.appendChild(opt);
  }
  currentModel = models.find(m => m.default)?.id ?? models[0].id;
  el.addEventListener('change', (e) => { currentModel = e.target.value; });
}

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

  window.location.href = `/game/${data.id}`;
}

function setLoading(on, msg = '') {
  const btn = document.getElementById('generate-btn');
  btn.disabled = on;
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
    ? 'mobile' : 'desktop';
}
