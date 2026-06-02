# Sona — Gold Chain Tracker

Mobile-first web app for your dad's gold chain business. Tracks raw gold received, finished chains, and settlement between raw fine gold given vs chain fine gold used.

---

## Project Structure

```
sona-app/
├── index.html          ← Main HTML (screens & layout)
├── css/
│   └── style.css       ← All styles
├── js/
│   ├── config.js       ← 🔑 YOUR SUPABASE KEYS GO HERE
│   ├── db.js           ← All database operations (Supabase)
│   ├── utils.js        ← Shared helpers (math, formatting, toast)
│   ├── calc.js         ← Live gold calculations
│   ├── ui.js           ← UI rendering, modals, navigation
│   └── app.js          ← Main controller (state + actions)
└── README_SETUP.sql    ← Run this in Supabase SQL Editor
```

---

## Setup (5 minutes)

### Step 1 — Create a Supabase project
1. Go to https://supabase.com and sign up (free)
2. Click **New Project**, give it a name (e.g. "sona-gold")
3. Wait for it to provision (~1 min)

### Step 2 — Create the database tables
1. In your Supabase project, go to **SQL Editor** → **New Query**
2. Open `README_SETUP.sql` from this folder
3. Paste the entire contents and click **Run**
4. You should see "Success" — your tables are ready

### Step 3 — Add your API keys (Local Testing)
1. In Supabase, go to **Project Settings** → **API**
2. Copy your **Project URL** and **anon/public** key
3. Open `js/config.js` and replace them.

> [!IMPORTANT]
> `js/config.js` is added to `.gitignore` so your keys are never committed to GitHub.

### Step 4 — Hosting on Vercel
To deploy securely on Vercel without committing keys:
1. In Vercel, import your GitHub repository.
2. In Vercel Project Settings → **Environment Variables**, add:
   - `SUPABASE_URL` = (your Supabase project URL)
   - `SUPABASE_ANON` = (your Supabase anon/public key)
3. Vercel will automatically run the build script (`node build.js`) to generate `js/config.js` with your keys on deployment.

### Step 5 — Open the app
- Locally: Double-click `index.html` to open in your browser.
- Online: Open your Vercel deployment link on any phone.

---

## Features

| Feature | Description |
|---|---|
| Raw entry | Enter customer name, date, weight (g+mg), purity of received gold, ordered purity |
| Live calc | Instantly shows pure fine gold as you type |
| Settle | Select an open entry, weigh the finished chain, calculate settlement |
| Settlement | Compares raw fine gold given vs chain fine gold used — shows who owes what in grams & mg |
| Edit | ✏️ Edit any raw entry or completed order at any time |
| Delete | 🗑️ Delete any entry or order |
| Customers | All customers with their full history — open entries and completed orders |
| Records | Full log of all completed orders |
| Database | All data stored in Supabase (PostgreSQL) — accessible from any phone/device |

---

## How settlement works

```
Raw fine gold = total raw weight × raw purity %
Chain fine gold = chain weight × chain purity %

If raw fine gold > chain fine gold:
  → Dad returns the difference to customer

If chain fine gold > raw fine gold:
  → Customer pays the shortfall to Dad

If equal:
  → All settled
```


---

## Database tables

**raw_entries** — gold received from customers
| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| customer_name | TEXT | Customer name |
| received_date | DATE | Date gold received |
| weight_g | NUMERIC | Weight in grams |
| weight_mg | NUMERIC | Weight in milligrams |
| purity | NUMERIC | Purity % of received gold |
| ordered_purity | NUMERIC | Purity % ordered |
| fine_gold | NUMERIC | Computed pure fine gold (g) |
| settled | BOOLEAN | Whether this entry is settled |

**orders** — completed chains
| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| customer_name | TEXT | Customer name |
| raw_entry_id | UUID | Reference to raw entry |
| raw_fine_gold | NUMERIC | Fine gold from raw entry |
| chain_weight_g | NUMERIC | Finished chain weight (g) |
| chain_weight_mg | NUMERIC | Finished chain weight (mg) |
| chain_purity | NUMERIC | Chain purity % |
| chain_fine_gold | NUMERIC | Computed fine gold in chain |
| gauge_mm | NUMERIC | Chain gauge in mm |
| diff | NUMERIC | Difference (+ = dad returns, - = customer pays) |
| completed_date | DATE | Date chain completed |
