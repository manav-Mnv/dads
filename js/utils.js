/* ============================================================
   js/utils.js — Shared utility functions
   ============================================================ */

// ── GOLD WEIGHT MATH ────────────────────────────────────────

/** Convert grams + milligrams to total grams (decimal) */
function toGrams(g, mg) {
  return (parseFloat(g) || 0) + (parseFloat(mg) || 0) / 1000;
}

/** Split decimal grams into { g, mg } */
function splitGrams(totalG) {
  let g  = Math.floor(totalG);
  let mg = Math.round((totalG - g) * 1000);
  if (mg >= 1000) {
    g += 1;
    mg -= 1000;
  }
  return { g, mg };
}

/** Format a decimal gram value as "Xg Ymg" */
function fmtGM(totalG) {
  const { g, mg } = splitGrams(totalG);
  return `${g}g ${mg}mg`;
}

/** Format a number to N decimal places */
function fmtN(n, decimals = 4) {
  return isNaN(n) ? '—' : Number(n).toFixed(decimals);
}

/** Compute fine gold: totalGrams × purity% */
function calcFineGold(g, mg, purity) {
  return toGrams(g, mg) * (parseFloat(purity) || 0) / 100;
}

// ── NAME HELPERS ─────────────────────────────────────────────

/** Get 1-2 initials from a name */
function initials(name) {
  return (name || '?')
    .trim()
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── DATE HELPERS ─────────────────────────────────────────────

/** Return today's date as YYYY-MM-DD */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── TOAST ────────────────────────────────────────────────────

let _toastTimer = null;
function toast(msg, duration = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── CONNECTION STATUS DOT ─────────────────────────────────────

function setConnStatus(online) {
  const dot = document.getElementById('conn-dot');
  if (!dot) return;
  dot.className = 'conn-dot ' + (online ? 'online' : 'offline');
  dot.title = online ? 'Connected to database' : 'Offline — check config';
}

// ── OPEN-BADGE COUNT ──────────────────────────────────────────

function updateBadge(count) {
  const b = document.getElementById('open-badge');
  if (!b) return;
  b.textContent = count;
  b.style.display = count > 0 ? '' : 'none';
}

// ── HTML ESCAPING FOR SAFETY ─────────────────────────────────

function escapeHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}
