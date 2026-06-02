/* ============================================================
   js/db.js — All database operations (Supabase)
   Tables: raw_entries, orders
   ============================================================ */

// ── INIT ────────────────────────────────────────────────────
let _sb = null;
try {
  if (typeof supabase !== 'undefined') {
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
} catch (e) {
  console.error('Failed to initialize Supabase client:', e);
}

// ── CONNECTION CHECK ────────────────────────────────────────
async function checkConnection() {
  if (!_sb) {
    setConnStatus(false);
    return false;
  }
  try {
    const { error } = await _sb.from('raw_entries').select('id').limit(1);
    setConnStatus(!error);
    return !error;
  } catch {
    setConnStatus(false);
    return false;
  }
}

// ── RAW ENTRIES ─────────────────────────────────────────────

/** Fetch all unsettled raw entries (open orders) */
async function db_getOpenEntries() {
  if (!_sb) throw new Error('Database client not initialized');
  const { data, error } = await _sb
    .from('raw_entries')
    .select('*')
    .eq('settled', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Fetch all raw entries (for customers screen) */
async function db_getAllEntries() {
  if (!_sb) throw new Error('Database client not initialized');
  const { data, error } = await _sb
    .from('raw_entries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Insert a new raw entry */
async function db_insertEntry(entry) {
  if (!_sb) throw new Error('Database client not initialized');
  const { data, error } = await _sb
    .from('raw_entries')
    .insert([entry])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update an existing raw entry by id */
async function db_updateEntry(id, updates) {
  if (!_sb) throw new Error('Database client not initialized');
  const { data, error } = await _sb
    .from('raw_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Mark a raw entry as settled */
async function db_settleEntry(id) {
  return db_updateEntry(id, { settled: true });
}

/** Delete a raw entry by id */
async function db_deleteEntry(id) {
  if (!_sb) throw new Error('Database client not initialized');
  const { error } = await _sb
    .from('raw_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── ORDERS (completed) ──────────────────────────────────────

/** Fetch all completed orders */
async function db_getOrders() {
  if (!_sb) throw new Error('Database client not initialized');
  const { data, error } = await _sb
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Insert a completed order */
async function db_insertOrder(order) {
  if (!_sb) throw new Error('Database client not initialized');
  const { data, error } = await _sb
    .from('orders')
    .insert([order])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update a completed order */
async function db_updateOrder(id, updates) {
  if (!_sb) throw new Error('Database client not initialized');
  const { data, error } = await _sb
    .from('orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a completed order */
async function db_deleteOrder(id) {
  if (!_sb) throw new Error('Database client not initialized');
  const { error } = await _sb
    .from('orders')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** Get all distinct customer names */
async function db_getCustomerNames() {
  if (!_sb) return [];
  try {
    const { data: entries } = await _sb.from('raw_entries').select('customer_name');
    const { data: orders }  = await _sb.from('orders').select('customer_name');
    const all = [...(entries||[]), ...(orders||[])]
      .map(r => {
        const rawName = r.customer_name || '';
        return rawName.split('|')[0].trim();
      })
      .filter(Boolean);
    return [...new Set(all)].sort();
  } catch {
    return [];
  }
}

