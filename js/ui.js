/* ============================================================
   js/ui.js — UI rendering, modals, screen navigation
   ============================================================ */

// ── SCREEN NAV ────────────────────────────────────────────────

function showScreen(s) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('screen-' + s).classList.add('active');
  document.querySelector(`.nav-tab[data-screen="${s}"]`).classList.add('active');

  if (s === 'product')   App.loadProductScreen();
  if (s === 'customers') App.loadCustomers();
  if (s === 'records')   App.loadRecords();
  if (s === 'raw')       App.loadCustList();
}

// ── LOADING STATE ─────────────────────────────────────────────

function showLoading(containerId, msg = 'Loading…') {
  document.getElementById(containerId).innerHTML =
    `<div class="loading-state"><span class="spinner"></span>${msg}</div>`;
}

// ── ENTRY LIST (product screen) ───────────────────────────────

function renderEntryList(entries) {
  const el = document.getElementById('entry-list');
  if (!entries.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚬</div><div class="empty-text">No open orders.<br>Add a raw entry first.</div></div>';
    document.getElementById('sel-summary').classList.remove('visible');
    document.getElementById('calc-settle-btn').style.display = 'none';
    document.getElementById('verdict-section').style.display = 'none';
    App.selectedEntryId   = null;
    App.selectedEntryData = null;
    return;
  }

  el.innerHTML = entries.map(e => `
    <div class="entry-option-card ${App.selectedEntryId === e.id ? 'selected' : ''}"
         onclick="selectEntry('${e.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="eoc-name">${escapeHtml(e.customer_name)}</div>
        <span class="pill pill-open">Open</span>
      </div>
      <div class="eoc-details">
        ${e.received_date} · ${e.weight_g}g ${e.weight_mg}mg · ${e.purity}%
        ${e.ordered_purity ? ' · Ordered: ' + e.ordered_purity + '%' : ''}
      </div>
      <div class="eoc-fine">Fine gold: ${fmtGM(e.fine_gold)} (${fmtN(e.fine_gold, 4)}g)</div>
    </div>
  `).join('');
}

// ── SELECT ENTRY ──────────────────────────────────────────────

function selectEntry(id) {
  const e = App.openEntries.find(x => x.id === id);
  if (!e) return;
  App.selectedEntryId   = id;
  App.selectedEntryData = e;
  renderEntryList(App.openEntries); // re-render to show selected

  const ss = document.getElementById('sel-summary');
  ss.classList.add('visible');
  document.getElementById('sel-cust-name').textContent  = e.customer_name;
  document.getElementById('sel-date').textContent       = e.received_date;
  document.getElementById('sel-ord-purity').textContent = e.ordered_purity ? e.ordered_purity + '%' : '—';
  document.getElementById('sel-fine').textContent       = fmtGM(e.fine_gold);
  document.getElementById('sel-raw-wt').textContent     = `${e.weight_g}g ${e.weight_mg}mg`;

  document.getElementById('verdict-section').style.display = 'none';
  checkCalcBtn();
}

// ── VERDICT ───────────────────────────────────────────────────

function showVerdict() {
  const e = App.selectedEntryData;
  if (!e) { toast('Select an order first'); return; }

  const container = document.getElementById('chains-container');
  if (!container) return;

  let totalChainFine = 0;
  let hasValidData = false;

  const cards = container.getElementsByClassName('chain-item-card');
  Array.from(cards).forEach(card => {
    const g      = parseFloat(card.querySelector('.chain-g').value)      || 0;
    const mg     = parseFloat(card.querySelector('.chain-mg').value)     || 0;
    const purity = parseFloat(card.querySelector('.chain-purity').value) || 0;

    if ((g > 0 || mg > 0) && purity > 0) {
      totalChainFine += calcFineGold(g, mg, purity);
      hasValidData = true;
    }
  });

  if (!hasValidData) {
    toast('Fill weight and purity for at least one chain');
    return;
  }

  const rawFine   = parseFloat(e.fine_gold);
  const diff      = rawFine - totalChainFine;

  document.getElementById('cmp-raw').textContent   = fmtGM(rawFine);
  document.getElementById('cmp-chain').textContent = fmtGM(totalChainFine);
  document.getElementById('cmp-diff').textContent  = fmtGM(Math.abs(diff));

  const vc = document.getElementById('verdict-card');
  const vt = document.getElementById('verdict-title');
  const vd = document.getElementById('verdict-desc');
  vc.className = 'verdict-card';

  if (Math.abs(diff) < 0.0005) {
    vc.classList.add('even');
    vt.textContent = 'All settled — gold is even';
    vd.textContent = 'Fine gold given exactly matches the chain(s). No gold to exchange.';
  } else if (diff > 0) {
    vc.classList.add('give');
    vt.textContent = `Dad returns ${fmtGM(diff)} to ${e.customer_name}`;
    vd.textContent = `${e.customer_name} gave more fine gold than used in the chain(s). Dad gives back ${fmtN(diff, 4)}g.`;
  } else {
    vc.classList.add('receive');
    vt.textContent = `${e.customer_name} pays ${fmtGM(-diff)} to Dad`;
    vd.textContent = `The chain(s) used more fine gold than received. ${e.customer_name} pays the shortfall of ${fmtN(-diff, 4)}g.`;
  }

  document.getElementById('verdict-section').style.display = '';
  document.getElementById('calc-settle-btn').style.display = 'none';
  document.getElementById('verdict-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── CUSTOMERS SCREEN ──────────────────────────────────────────

function renderCustomers(entries, orders) {
  const body = document.getElementById('customers-body');
  const names = [...new Set([...entries, ...orders].map(r => {
    const rawName = r.customer_name || '';
    return rawName.split('|')[0].trim();
  }).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  if (!names.length) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">No customers yet.<br>Add a raw entry to get started.</div></div>';
    return;
  }

  body.innerHTML = names.map(name => {
    const cEntries    = entries.filter(e => e.customer_name === name);
    const cOrders     = orders.filter(r => (r.customer_name || '').split('|')[0].trim() === name);
    const openCount   = cEntries.filter(e => !e.settled).length;
    const domId       = 'cb_' + name.replace(/\W/g, '_');

    const entriesHTML = cEntries.map(e => `
      <div class="order-item">
        <div class="order-item-top">
          <div class="order-item-title">${e.received_date} · ${e.weight_g}g ${e.weight_mg}mg · ${e.purity}%</div>
          <div class="order-actions">
            ${!e.settled ? `<button class="btn-icon btn-edit" title="Edit" onclick="openEditEntry('${e.id}')">✏️</button>` : ''}
            <button class="btn-icon btn-delete" title="Delete" onclick="confirmDeleteEntry('${e.id}')">🗑️</button>
          </div>
        </div>
        <span class="pill ${e.settled ? 'pill-done' : 'pill-open'}" style="margin-bottom:8px;display:inline-block;">
          ${e.settled ? 'Settled' : 'Open'}
        </span>
        <div class="order-item-grid">
          <div><div class="oig-label">Fine gold</div><div class="oig-val">${fmtGM(e.fine_gold)}</div></div>
          <div><div class="oig-label">Ordered purity</div><div class="oig-val">${e.ordered_purity ? e.ordered_purity + '%' : '—'}</div></div>
          <div><div class="oig-label">Status</div><div class="oig-val">${e.settled ? 'Settled' : 'Pending'}</div></div>
        </div>
      </div>
    `).join('');

    const ordersHTML = cOrders.map(r => {
      const diff = parseFloat(r.diff);
      let pillClass = 'pill-even', pillText = 'Even';
      if (Math.abs(diff) > 0.0005) {
        pillClass = diff > 0 ? 'pill-give' : 'pill-receive';
        pillText  = diff > 0 ? `Returned ${fmtGM(diff)}` : `Received ${fmtGM(-diff)}`;
      }

      const hasMultipleChains = r.customer_name && r.customer_name.includes('|');
      let chains = [];
      if (hasMultipleChains) {
        try {
          chains = JSON.parse(r.customer_name.split('|')[1]);
        } catch (err) {
          console.error("Failed to parse chains JSON:", err);
        }
      }

      const titleText = chains.length > 0
        ? `Chains (${chains.length}) · Total: ${r.chain_weight_g}g ${r.chain_weight_mg}mg`
        : `Chain · ${r.completed_date} · ${r.chain_weight_g}g ${r.chain_weight_mg}mg · ${r.chain_purity}%`;

      let chainsListHTML = '';
      if (chains.length > 0) {
        chainsListHTML = `
          <div style="margin-top: 8px; border-top: 1px dashed var(--cream3); padding-top: 8px;">
            <div class="oig-label" style="margin-bottom: 4px;">Chains Breakdown</div>
            ${chains.map((c, i) => `
              <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--ink2); margin-bottom: 2px;">
                <span>#${i+1} · ${c.completed_date}</span>
                <span>${c.g}g ${c.mg}mg · ${c.purity}% ${c.gauge_mm ? `· ${c.gauge_mm}mm` : ''}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      return `
        <div class="order-item">
          <div class="order-item-top">
            <div class="order-item-title">${titleText}</div>
            <div class="order-actions">
              <button class="btn-icon btn-edit" title="Edit" onclick="openEditOrder('${r.id}')">✏️</button>
              <button class="btn-icon btn-delete" title="Delete" onclick="confirmDeleteOrder('${r.id}')">🗑️</button>
            </div>
          </div>
          <span class="pill ${pillClass}" style="margin-bottom:8px;display:inline-block;">${pillText}</span>
          <div class="order-item-grid">
            <div><div class="oig-label">Raw fine gold</div><div class="oig-val">${fmtGM(r.raw_fine_gold)}</div></div>
            <div><div class="oig-label">Chain fine gold</div><div class="oig-val">${fmtGM(r.chain_fine_gold)}</div></div>
            <div><div class="oig-label">Gauge</div><div class="oig-val">${r.gauge_mm ? r.gauge_mm + 'mm' : '—'}</div></div>
          </div>
          ${chainsListHTML}
        </div>
      `;
    }).join('');

    return `
      <div class="cust-card">
        <div class="cust-header" onclick="toggleCust('${domId}')">
          <div style="display:flex;align-items:center;">
            <div class="cust-avatar">${initials(name)}</div>
            <div class="cust-info">
              <div class="cust-name">${escapeHtml(name)}${openCount > 0 ? `<span class="open-pill">${openCount} open</span>` : ''}</div>
              <div class="cust-meta">${cEntries.length} entr${cEntries.length === 1 ? 'y' : 'ies'} · ${cOrders.length} done</div>
            </div>
          </div>
          <div class="cust-arrow" id="arr_${domId}">›</div>
        </div>
        <div class="cust-body" id="${domId}">
          <div class="cust-body-inner">
            ${cEntries.length ? `<div class="sub-label">Raw entries</div>${entriesHTML}` : ''}
            ${cOrders.length  ? `<div class="sub-label">Completed orders</div>${ordersHTML}` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleCust(id) {
  const body  = document.getElementById(id);
  const arrow = document.getElementById('arr_' + id);
  const open  = body.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open', open);
}

// ── RECORDS SCREEN ────────────────────────────────────────────

function renderRecords(orders) {
  const body     = document.getElementById('records-body');
  const clearBtn = document.getElementById('clear-btn');

  if (!orders.length) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">No completed orders yet.</div></div>';
    clearBtn.style.display = 'none';
    return;
  }

  clearBtn.style.display = '';
  body.innerHTML = orders.map(r => {
    const diff = parseFloat(r.diff);
    let pillClass = 'pill-even', pillText = 'Even';
    if (Math.abs(diff) > 0.0005) {
      pillClass = diff > 0 ? 'pill-give' : 'pill-receive';
      pillText  = diff > 0 ? `Return ${fmtGM(diff)}` : `Receive ${fmtGM(-diff)}`;
    }

    const cleanName = (r.customer_name || '').split('|')[0].trim();
    const hasMultipleChains = r.customer_name && r.customer_name.includes('|');
    let chains = [];
    if (hasMultipleChains) {
      try {
        chains = JSON.parse(r.customer_name.split('|')[1]);
      } catch (err) {
        console.error("Failed to parse chains JSON:", err);
      }
    }

    let chainsListHTML = '';
    if (chains.length > 0) {
      chainsListHTML = `
        <div style="grid-column: span 2; margin-top: 8px; border-top: 1px dashed var(--cream3); padding-top: 8px;">
          <div class="rg-label" style="margin-bottom: 4px;">Chains Breakdown</div>
          ${chains.map((c, i) => `
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--ink2); margin-bottom: 2px;">
              <span>#${i+1} · ${c.completed_date}</span>
              <span>${c.g}g ${c.mg}mg · ${c.purity}% ${c.gauge_mm ? `· ${c.gauge_mm}mm` : ''}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="record-card anim">
        <div class="record-top">
          <div class="record-top-left">
            <div class="record-name">${escapeHtml(cleanName)}</div>
            <div class="record-dates">Received ${r.raw_date} · Done ${r.completed_date || '—'}</div>
          </div>
          <div class="record-top-right">
            <span class="pill ${pillClass}">${pillText}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn-icon btn-edit"   title="Edit"   onclick="openEditOrder('${r.id}')">✏️</button>
              <button class="btn-icon btn-delete" title="Delete" onclick="confirmDeleteOrder('${r.id}')">🗑️</button>
            </div>
          </div>
        </div>
        <div class="record-grid">
          <div class="rg-item"><div class="rg-label">Chain weight</div><div class="rg-val">${r.chain_weight_g}g ${r.chain_weight_mg}mg</div></div>
          <div class="rg-item"><div class="rg-label">Purity / Gauge</div><div class="rg-val">${r.chain_purity}% / ${r.gauge_mm ? r.gauge_mm + 'mm' : '—'}</div></div>
          <div class="rg-item"><div class="rg-label">Raw fine gold</div><div class="rg-val">${fmtGM(r.raw_fine_gold)}</div></div>
          <div class="rg-item"><div class="rg-label">Chain fine gold</div><div class="rg-val">${fmtGM(r.chain_fine_gold)}</div></div>
          ${chainsListHTML}
        </div>
      </div>
    `;
  }).join('');
}

// ── EDIT MODAL — RAW ENTRY ────────────────────────────────────

function openEditEntry(id) {
  const e = [...App.openEntries, ...App.allEntries].find(x => x.id === id);
  if (!e) return;

  document.getElementById('modal-title').textContent = 'Edit Raw Entry';
  document.getElementById('modal-body').innerHTML = `
    <div class="field">
      <label>Customer name</label>
      <input type="text" id="me-cust" value="${escapeHtml(e.customer_name)}" />
    </div>
    <div class="field-row">
      <div class="field"><label>Date received</label><input type="date" id="me-date" value="${e.received_date}" /></div>
      <div class="field"><label>Ordered purity %</label><input type="number" id="me-ord-purity" value="${e.ordered_purity || ''}" inputmode="decimal" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Weight (g)</label><input type="number" id="me-g" value="${e.weight_g}" inputmode="decimal" /></div>
      <div class="field"><label>Weight (mg)</label><input type="number" id="me-mg" value="${e.weight_mg}" inputmode="decimal" /></div>
    </div>
    <div class="field">
      <label>Purity of received gold (%)</label>
      <input type="number" id="me-purity" value="${e.purity}" inputmode="decimal" />
    </div>
    <div class="modal-footer" style="padding:0;margin-top:20px;display:flex;gap:10px;">
      <button class="btn btn-outline" style="margin-top:0;" onclick="closeModal()">Cancel</button>
      <button class="btn btn-gold"    style="margin-top:0;" onclick="submitEditEntry('${id}')">Save changes</button>
    </div>
  `;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function submitEditEntry(id) {
  const cust   = document.getElementById('me-cust').value.trim();
  const date   = document.getElementById('me-date').value;
  const ordP   = parseFloat(document.getElementById('me-ord-purity').value) || 0;
  const g      = parseFloat(document.getElementById('me-g').value)          || 0;
  const mg     = parseFloat(document.getElementById('me-mg').value)         || 0;
  const purity = parseFloat(document.getElementById('me-purity').value)     || 0;

  if (!cust || !date || (g === 0 && mg === 0) || purity === 0) {
    toast('Please fill all required fields'); return;
  }

  const fine = calcFineGold(g, mg, purity);
  try {
    await db_updateEntry(id, {
      customer_name: cust,
      received_date: date,
      ordered_purity: ordP,
      weight_g: g,
      weight_mg: mg,
      purity: purity,
      fine_gold: fine,
    });
    toast('Entry updated');
    closeModal();
    App.loadCustomers();
    App.loadProductScreen();
    App.loadCustList();
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

// ── EDIT MODAL — ORDER ────────────────────────────────────────

function openEditOrder(id) {
  const r = App.allOrders.find(x => x.id === id);
  if (!r) return;

  const cleanName = r.customer_name.split('|')[0].trim();
  const hasMultipleChains = r.customer_name.includes('|');
  let chains = [];
  if (hasMultipleChains) {
    try {
      chains = JSON.parse(r.customer_name.split('|')[1]);
    } catch (err) {
      console.error(err);
    }
  } else {
    // Single chain fallback
    chains = [{
      completed_date: r.completed_date,
      gauge_mm: r.gauge_mm,
      g: r.chain_weight_g,
      mg: r.chain_weight_mg,
      purity: r.chain_purity
    }];
  }

  document.getElementById('modal-title').textContent = 'Edit Completed Order';
  document.getElementById('modal-body').innerHTML = `
    <div style="font-size: 14px; font-weight:600; color:var(--ink); margin-bottom: 12px;">Customer: ${escapeHtml(cleanName)}</div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <span style="font-size:11px; font-weight:600; color:var(--ink3); text-transform:uppercase;">Chains List</span>
      <button type="button" class="btn btn-sm btn-primary" style="width:auto; margin-top:0; padding:6px 12px; font-size:11px;" onclick="addModalChainInput()">+ Add chain</button>
    </div>
    <div id="modal-chains-container"></div>
    <div class="modal-footer" style="padding:0;margin-top:20px;display:flex;gap:10px;">
      <button class="btn btn-outline" style="margin-top:0;" onclick="closeModal()">Cancel</button>
      <button class="btn btn-gold"    style="margin-top:0;" onclick="submitEditOrder('${id}')">Save changes</button>
    </div>
  `;

  // Render existing chains
  chains.forEach(c => addModalChainInput(c));
  document.getElementById('edit-modal').style.display = 'flex';
}

async function submitEditOrder(id) {
  const r = App.allOrders.find(x => x.id === id);
  if (!r) return;

  const container = document.getElementById('modal-chains-container');
  if (!container) return;

  const cards = container.getElementsByClassName('modal-chain-item-card');
  const chains = [];
  let totalWeight = 0;
  let totalChainFine = 0;
  let latestCompletionDate = todayStr();
  let firstGauge = 0;

  Array.from(cards).forEach((card, idx) => {
    const g      = parseFloat(card.querySelector('.m-chain-g').value)      || 0;
    const mg     = parseFloat(card.querySelector('.m-chain-mg').value)     || 0;
    const purity = parseFloat(card.querySelector('.m-chain-purity').value) || 0;
    const gauge  = parseFloat(card.querySelector('.m-chain-gauge').value)  || 0;
    const date   = card.querySelector('.m-chain-date').value || todayStr();

    if ((g > 0 || mg > 0) && purity > 0) {
      const fine = calcFineGold(g, mg, purity);
      totalChainFine += fine;
      totalWeight += toGrams(g, mg);
      latestCompletionDate = date;
      if (idx === 0) {
        firstGauge = gauge;
      }
      chains.push({
        completed_date: date,
        gauge_mm: gauge,
        g,
        mg,
        purity
      });
    }
  });

  if (chains.length === 0) {
    toast('Please enter details for at least one chain');
    return;
  }

  const { g: sumG, mg: sumMg } = splitGrams(totalWeight);
  const rawFine = parseFloat(r.raw_fine_gold);
  const diff = rawFine - totalChainFine;
  
  const avgPurity = totalWeight > 0 ? (totalChainFine / totalWeight) * 100 : 0;
  const cleanName = r.customer_name.split('|')[0].trim();
  const serializedName = `${cleanName} | ${JSON.stringify(chains)}`;

  try {
    await db_updateOrder(id, {
      customer_name:   serializedName,
      completed_date:  latestCompletionDate,
      chain_weight_g:  sumG,
      chain_weight_mg: sumMg,
      chain_purity:    parseFloat(avgPurity.toFixed(2)),
      chain_fine_gold: totalChainFine,
      gauge_mm:        firstGauge || null,
      diff:            diff,
    });
    toast('Order updated');
    closeModal();
    App.loadRecords();
    App.loadCustomers();
    App.loadCustList();
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

// ── MODAL MULTI-CHAIN HELPERS ─────────────────────────────────

function addModalChainInput(data = null) {
  const container = document.getElementById('modal-chains-container');
  if (!container) return;
  const index = container.children.length;

  const card = document.createElement('div');
  card.className = 'modal-chain-item-card card';
  card.style.position = 'relative';
  card.style.padding = '12px';
  card.style.marginBottom = '8px';
  card.style.background = 'var(--cream)';

  const dateVal = data && data.completed_date ? data.completed_date : todayStr();
  const gaugeVal = data && data.gauge_mm ? data.gauge_mm : '';
  const gVal = (data && data.g !== undefined) ? data.g : '';
  const mgVal = (data && data.mg !== undefined) ? data.mg : '';
  const purityVal = data && data.purity ? data.purity : '';

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;">Chain #${index + 1}</span>
      <button type="button" class="btn-icon btn-delete" style="width:24px;height:24px;font-size:10px;" title="Remove chain" onclick="removeModalChainInput(this)">✕</button>
    </div>
    <div class="field-row" style="margin-bottom:8px;">
      <div class="field" style="margin-bottom:0;"><label style="font-size:10px;margin-bottom:2px;">Completion date</label><input type="date" class="m-chain-date" value="${dateVal}" style="padding:8px;" /></div>
      <div class="field" style="margin-bottom:0;"><label style="font-size:10px;margin-bottom:2px;">Gauge (mm)</label><input type="number" class="m-chain-gauge" value="${gaugeVal}" placeholder="e.g. 1.2" inputmode="decimal" style="padding:8px;" /></div>
    </div>
    <div class="field-row" style="margin-bottom:8px;">
      <div class="field" style="margin-bottom:0;"><label style="font-size:10px;margin-bottom:2px;">Weight (g)</label><input type="number" class="m-chain-g" value="${gVal}" placeholder="0" inputmode="decimal" style="padding:8px;" /></div>
      <div class="field" style="margin-bottom:0;"><label style="font-size:10px;margin-bottom:2px;">Weight (mg)</label><input type="number" class="m-chain-mg" value="${mgVal}" placeholder="0" inputmode="decimal" min="0" max="999" style="padding:8px;" /></div>
    </div>
    <div class="field" style="margin-bottom:0;">
      <label style="font-size:10px;margin-bottom:2px;">Purity (%)</label>
      <input type="number" class="m-chain-purity" value="${purityVal}" placeholder="e.g. 91.6" inputmode="decimal" style="padding:8px;" />
    </div>
  `;

  container.appendChild(card);
  updateModalChainNumbers();
}

function removeModalChainInput(button) {
  const card = button.closest('.modal-chain-item-card');
  const container = document.getElementById('modal-chains-container');
  if (container.children.length <= 1) {
    toast('At least one chain is required.');
    return;
  }
  card.remove();
  updateModalChainNumbers();
}

function updateModalChainNumbers() {
  const container = document.getElementById('modal-chains-container');
  if (!container) return;
  Array.from(container.children).forEach((card, idx) => {
    const label = card.querySelector('span');
    if (label) {
      label.textContent = `Chain #${idx + 1}`;
    }
  });
}

// ── DELETE CONFIRMS ───────────────────────────────────────────

function confirmDeleteEntry(id) {
  const e = [...App.openEntries, ...App.allEntries].find(x => x.id === id);
  const name = e ? e.customer_name : 'this customer';
  if (!confirm(`Delete this raw entry for ${name}? This cannot be undone.`)) return;
  App.deleteEntry(id);
}

function confirmDeleteOrder(id) {
  const r = App.allOrders.find(x => x.id === id);
  const name = r ? r.customer_name : 'this customer';
  if (!confirm(`Delete this completed order for ${name}? This cannot be undone.`)) return;
  App.deleteOrder(id);
}

// ── MODAL CLOSE ───────────────────────────────────────────────

function closeModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

// Close modal on overlay click
document.getElementById('edit-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── MULTI-CHAIN INPUT MANAGEMENT ──────────────────────────────

function addChainInput(data = null) {
  const container = document.getElementById('chains-container');
  if (!container) return;
  const index = container.children.length;

  const card = document.createElement('div');
  card.className = 'chain-item-card card anim';
  card.style.position = 'relative';

  const dateVal = data && data.completed_date ? data.completed_date : todayStr();
  const gaugeVal = data && data.gauge_mm ? data.gauge_mm : '';
  const gVal = (data && data.g !== undefined) ? data.g : '';
  const mgVal = (data && data.mg !== undefined) ? data.mg : '';
  const purityVal = data && data.purity ? data.purity : (App.selectedEntryData ? App.selectedEntryData.ordered_purity || '' : '');

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-size:12px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.05em;">Chain #${index + 1}</span>
      <button type="button" class="btn-icon btn-delete" style="width:28px;height:28px;font-size:12px;" title="Remove chain" onclick="removeChainInput(this)">✕</button>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Completion date</label>
        <input type="date" class="chain-date" value="${dateVal}" />
      </div>
      <div class="field">
        <label>Gauge (mm)</label>
        <input type="number" class="chain-gauge" value="${gaugeVal}" placeholder="e.g. 1.2" inputmode="decimal" oninput="calcProd()" />
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Chain weight (g)</label>
        <input type="number" class="chain-g" value="${gVal}" placeholder="0" inputmode="decimal" oninput="calcProd()" />
      </div>
      <div class="field">
        <label>Chain weight (mg)</label>
        <input type="number" class="chain-mg" value="${mgVal}" placeholder="0" inputmode="decimal" min="0" max="999" oninput="calcProd()" />
      </div>
    </div>
    <div class="field" style="margin-bottom:0;">
      <label>Chain purity (%)</label>
      <input type="number" class="chain-purity" value="${purityVal}" placeholder="e.g. 91.6" inputmode="decimal" oninput="calcProd()" />
    </div>
  `;

  container.appendChild(card);
  updateChainNumbers();
  calcProd();
}

function removeChainInput(button) {
  const card = button.closest('.chain-item-card');
  const container = document.getElementById('chains-container');
  if (container.children.length <= 1) {
    toast('At least one chain is required.');
    return;
  }
  card.remove();
  updateChainNumbers();
  calcProd();
}

function updateChainNumbers() {
  const container = document.getElementById('chains-container');
  if (!container) return;
  Array.from(container.children).forEach((card, idx) => {
    const label = card.querySelector('span');
    if (label) {
      label.textContent = `Chain #${idx + 1}`;
    }
  });
}

function resetChainsContainer() {
  const container = document.getElementById('chains-container');
  if (container) {
    container.innerHTML = '';
    addChainInput();
  }
}
