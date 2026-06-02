/* ============================================================
   js/app.js — Main app controller
   Manages state and orchestrates db ↔ ui
   ============================================================ */

const App = {
  // ── STATE ────────────────────────────────────────────────
  openEntries:      [],   // unsettled raw entries (for Settle tab)
  allEntries:       [],   // all raw entries (for Customers tab)
  allOrders:        [],   // all completed orders
  selectedEntryId:  null,
  selectedEntryData: null,

  // ── INIT ─────────────────────────────────────────────────
  async init() {
    // Set today's date in inputs
    document.getElementById('raw-date').value  = todayStr();
    document.getElementById('prod-date').value = todayStr();

    // Header date
    document.getElementById('hdr-date').textContent =
      new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    // Check DB connection
    const ok = await checkConnection();
    if (!ok) {
      toast('⚠️ Not connected to database — check js/config.js', 4000);
    }

    // Load initial data
    await this.loadCustList();
    await this.refreshBadge();
  },

  // ── CUSTOMER AUTOCOMPLETE ────────────────────────────────
  async loadCustList() {
    try {
      const names = await db_getCustomerNames();
      document.getElementById('cust-datalist').innerHTML =
        names.map(n => `<option value="${n}">`).join('');
    } catch {}
  },

  // ── BADGE ────────────────────────────────────────────────
  async refreshBadge() {
    try {
      const open = await db_getOpenEntries();
      updateBadge(open.length);
    } catch {}
  },

  // ── PRODUCT SCREEN ────────────────────────────────────────
  async loadProductScreen() {
    showLoading('entry-list', 'Loading open orders…');
    try {
      this.openEntries = await db_getOpenEntries();
      renderEntryList(this.openEntries);
      updateBadge(this.openEntries.length);
      resetChainsContainer();
    } catch (err) {
      document.getElementById('entry-list').innerHTML =
        `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error loading orders.<br>${err.message}</div></div>`;
    }
  },

  // ── CUSTOMERS SCREEN ──────────────────────────────────────
  async loadCustomers() {
    showLoading('customers-body', 'Loading customers…');
    try {
      this.allEntries = await db_getAllEntries();
      this.allOrders  = await db_getOrders();
      renderCustomers(this.allEntries, this.allOrders);
    } catch (err) {
      document.getElementById('customers-body').innerHTML =
        `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error loading data.<br>${err.message}</div></div>`;
    }
  },

  // ── RECORDS SCREEN ────────────────────────────────────────
  async loadRecords() {
    showLoading('records-body', 'Loading records…');
    try {
      this.allOrders = await db_getOrders();
      renderRecords(this.allOrders);
    } catch (err) {
      document.getElementById('records-body').innerHTML =
        `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error loading records.<br>${err.message}</div></div>`;
    }
  },

  // ── SAVE RAW ENTRY ────────────────────────────────────────
  async saveRaw() {
    const cust   = document.getElementById('raw-cust').value.trim();
    const date   = document.getElementById('raw-date').value   || todayStr();
    const g      = parseFloat(document.getElementById('raw-g').value)          || 0;
    const mg     = parseFloat(document.getElementById('raw-mg').value)         || 0;
    const purity = parseFloat(document.getElementById('raw-purity').value)     || 0;
    const ordP   = parseFloat(document.getElementById('raw-ord-purity').value) || 0;

    if (!cust)                          { toast('Please enter customer name'); return; }
    if ((g === 0 && mg === 0) || purity === 0) { toast('Enter weight and purity');   return; }

    const fine = calcFineGold(g, mg, purity);

    try {
      await db_insertEntry({
        customer_name:  cust,
        received_date:  date,
        weight_g:       g,
        weight_mg:      mg,
        purity:         purity,
        ordered_purity: ordP,
        fine_gold:      fine,
        settled:        false,
      });

      toast(`Entry saved for ${cust}`);
      ['raw-cust','raw-g','raw-mg','raw-purity','raw-ord-purity']
        .forEach(id => document.getElementById(id).value = '');
      document.getElementById('raw-date').value = todayStr();
      calcRaw();
      this.loadCustList();
      this.refreshBadge();

    } catch (err) {
      toast('Save failed: ' + err.message);
    }
  },

  // ── SAVE COMPLETED ORDER ──────────────────────────────────
  async saveRecord() {
    const e = this.selectedEntryData;
    if (!e) return;

    const container = document.getElementById('chains-container');
    if (!container) return;

    const cards = container.getElementsByClassName('chain-item-card');
    const chains = [];
    let totalWeight = 0;
    let totalChainFine = 0;
    let latestCompletionDate = todayStr();
    let firstGauge = 0;

    Array.from(cards).forEach((card, idx) => {
      const g      = parseFloat(card.querySelector('.chain-g').value)      || 0;
      const mg     = parseFloat(card.querySelector('.chain-mg').value)     || 0;
      const purity = parseFloat(card.querySelector('.chain-purity').value) || 0;
      const gauge  = parseFloat(card.querySelector('.chain-gauge').value)  || 0;
      const date   = card.querySelector('.chain-date').value || todayStr();

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
    const rawFine = parseFloat(e.fine_gold);
    const diff = rawFine - totalChainFine;
    
    // Weighted average purity: totalFine / totalWeight * 100
    const avgPurity = totalWeight > 0 ? (totalChainFine / totalWeight) * 100 : 0;

    // Serialize chains info into customer_name
    const serializedName = `${e.customer_name} | ${JSON.stringify(chains)}`;

    try {
      // Insert the completed order
      await db_insertOrder({
        customer_name:   serializedName,
        raw_entry_id:    e.id,
        raw_date:        e.received_date,
        raw_fine_gold:   rawFine,
        completed_date:  latestCompletionDate,
        chain_weight_g:  sumG,
        chain_weight_mg: sumMg,
        chain_purity:    parseFloat(avgPurity.toFixed(2)),
        chain_fine_gold: totalChainFine,
        gauge_mm:        firstGauge || null,
        diff:            diff,
      });

      // Mark the raw entry as settled
      await db_settleEntry(e.id);

      toast(`Order completed for ${e.customer_name}`);

      // Reset product screen
      this.selectedEntryId   = null;
      this.selectedEntryData = null;
      
      resetChainsContainer();
      document.getElementById('sel-summary').classList.remove('visible');
      document.getElementById('verdict-section').style.display = 'none';
      document.getElementById('calc-settle-btn').style.display = 'none';

      this.refreshBadge();
      showScreen('customers');

    } catch (err) {
      toast('Save failed: ' + err.message);
    }
  },

  // ── DELETE RAW ENTRY ──────────────────────────────────────
  async deleteEntry(id) {
    try {
      await db_deleteEntry(id);
      toast('Entry deleted');
      this.loadCustomers();
      this.loadProductScreen();
      this.loadCustList();
      this.refreshBadge();
    } catch (err) {
      toast('Delete failed: ' + err.message);
    }
  },

  // ── DELETE ORDER ──────────────────────────────────────────
  async deleteOrder(id) {
    try {
      // Find the order being deleted to retrieve its raw_entry_id
      const order = this.allOrders.find(x => x.id === id);
      if (order && order.raw_entry_id) {
        await db_updateEntry(order.raw_entry_id, { settled: false });
      }
      await db_deleteOrder(id);
      toast('Order deleted');
      this.loadRecords();
      this.loadCustomers();
      this.loadProductScreen();
      this.loadCustList();
      this.refreshBadge();
    } catch (err) {
      toast('Delete failed: ' + err.message);
    }
  },

  // ── CLEAR ALL ─────────────────────────────────────────────
  async clearAll() {
    if (!confirm('Delete ALL entries and records? This cannot be undone.')) return;
    try {
      // Supabase delete all rows (no filter = all rows)
      await _sb.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await _sb.from('raw_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      toast('All data cleared');
      this.loadRecords();
      this.loadCustomers();
      this.loadProductScreen();
      this.loadCustList();
      this.refreshBadge();
    } catch (err) {
      toast('Error: ' + err.message);
    }
  },
};

// ── GLOBAL SHIMS (called from HTML onclick) ──────────────────
function saveRaw()     { App.saveRaw(); }
function saveRecord()  { App.saveRecord(); }
function clearAll()    { App.clearAll(); }

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
