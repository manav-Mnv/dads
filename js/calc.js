/* ============================================================
   js/calc.js — Live calculation functions (DOM → results)
   ============================================================ */

// ── RAW ENTRY CALC ───────────────────────────────────────────

function calcRaw() {
  const g      = parseFloat(document.getElementById('raw-g').value)      || 0;
  const mg     = parseFloat(document.getElementById('raw-mg').value)      || 0;
  const purity = parseFloat(document.getElementById('raw-purity').value)  || 0;

  const total    = toGrams(g, mg);
  const fine     = calcFineGold(g, mg, purity);
  const hasData  = (g > 0 || mg > 0) && purity > 0;

  document.getElementById('raw-fine-banner').style.opacity  = hasData ? '1' : '0.4';
  document.getElementById('raw-result-grid').style.opacity  = hasData ? '1' : '0.4';
  document.getElementById('raw-fine-val').textContent       = hasData ? fmtGM(fine)          : '— g — mg';
  document.getElementById('raw-fine-precise').textContent   = hasData ? fmtN(fine, 4) + 'g precise' : 'Enter weight & purity above';
  document.getElementById('raw-purity-badge').textContent   = purity  ? purity + '%'          : '?%';
  document.getElementById('raw-total-val').textContent      = hasData ? fmtN(total, 3)        : '—';
  document.getElementById('raw-precise-val').textContent    = hasData ? fmtN(fine, 4)         : '—';
}

// ── PRODUCT CALC ─────────────────────────────────────────────

function calcProd() {
  const container = document.getElementById('chains-container');
  if (!container) return;

  let totalFine = 0;
  let totalWeight = 0;
  let hasValidData = false;
  let samplePurity = 0;

  const cards = container.getElementsByClassName('chain-item-card');
  Array.from(cards).forEach(card => {
    const g      = parseFloat(card.querySelector('.chain-g').value)      || 0;
    const mg     = parseFloat(card.querySelector('.chain-mg').value)     || 0;
    const purity = parseFloat(card.querySelector('.chain-purity').value) || 0;

    if ((g > 0 || mg > 0) && purity > 0) {
      totalFine += calcFineGold(g, mg, purity);
      totalWeight += toGrams(g, mg);
      hasValidData = true;
      samplePurity = purity; // Use the last valid purity for the badge
    }
  });

  const banner = document.getElementById('prod-fine-banner');
  banner.style.opacity = hasValidData ? '1' : '0.4';
  document.getElementById('prod-fine-val').textContent      = hasValidData ? fmtGM(totalFine) : '— g — mg';
  document.getElementById('prod-fine-precise').textContent  = hasValidData ? fmtN(totalFine, 4) + 'g precise' : 'Enter chain details above';
  document.getElementById('prod-purity-badge').textContent  = hasValidData ? (cards.length > 1 ? 'Multi%' : samplePurity + '%') : '?%';

  // Hide verdict if inputs change
  document.getElementById('verdict-section').style.display = 'none';
  checkCalcBtn();
}

// ── CALC BUTTON VISIBILITY ────────────────────────────────────

function checkCalcBtn() {
  const container = document.getElementById('chains-container');
  if (!container) return;

  let hasValidData = false;
  const cards = container.getElementsByClassName('chain-item-card');
  Array.from(cards).forEach(card => {
    const g      = parseFloat(card.querySelector('.chain-g').value)      || 0;
    const mg     = parseFloat(card.querySelector('.chain-mg').value)     || 0;
    const purity = parseFloat(card.querySelector('.chain-purity').value) || 0;
    if ((g > 0 || mg > 0) && purity > 0) {
      hasValidData = true;
    }
  });

  const show = App.selectedEntryId !== null && hasValidData;
  document.getElementById('calc-settle-btn').style.display = show ? '' : 'none';
}
