// ── State ─────────────────────────────────────────────────
let shareData = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const slug = window.location.pathname.split('/').pop();
  if (!slug) return showError('Invalid share link.');

  let data;
  try {
    const res = await fetch(`/api/share/${slug}`);
    if (!res.ok) throw new Error('Share not found.');
    data = await res.json();
  } catch (err) {
    return showError(err.message);
  }

  shareData = data;
  renderMeta(data);
  document.getElementById('play-bar').classList.remove('hidden');
});

// ── Render metadata ────────────────────────────────────────
function renderMeta(data) {
  const card = document.getElementById('meta-card');

  const prompts = data.prompts || [];
  const listItems = prompts.map((p, i) => {
    const li = document.createElement('li');
    li.dataset.index = i + 1;
    li.textContent = p.content;
    return li.outerHTML;
  }).join('');

  card.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
      <span style="font-weight:600; font-size:0.95rem;">Prompts used</span>
      <span class="meta-badge">${escapeHtml(data.model)}</span>
      <span class="meta-badge">${escapeHtml(data.platform)}</span>
    </div>
    ${prompts.length
      ? `<ul class="prompt-list">${listItems}</ul>`
      : `<p style="color:var(--text-muted); font-size:0.88rem; margin:0;">No prompts recorded.</p>`
    }
  `;
}

// ── Play ──────────────────────────────────────────────────
function playGame() {
  if (!shareData) return;
  const slug = window.location.pathname.split('/').pop();
  const section = document.getElementById('game-section');
  document.getElementById('game-frame').src = `/api/share/${slug}/frame`;
  section.classList.remove('hidden');
  document.getElementById('play-btn').disabled = true;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Fork & Edit ───────────────────────────────────────────
async function forkGame() {
  if (!shareData) return;

  const btn = document.getElementById('fork-btn');
  btn.disabled = true;
  btn.textContent = 'Forking…';

  let data;
  try {
    const res = await fetch(`/api/games/${shareData.gameId}/fork`, { method: 'POST' });
    data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '✏️ Fork & Edit';
    alert('Fork failed: ' + err.message);
    return;
  }

  window.location.href = `/?gameId=${data.id}`;
}

// ── Utils ─────────────────────────────────────────────────
function showError(msg) {
  document.getElementById('meta-card').innerHTML =
    `<p style="color:var(--danger); margin:0;">${escapeHtml(msg)}</p>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
