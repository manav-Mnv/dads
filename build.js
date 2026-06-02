const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE';
const anon = process.env.SUPABASE_ANON || 'YOUR_SUPABASE_ANON_KEY_HERE';

const content = `/* ============================================================
js/config.js — Supabase connection config (generated)
============================================================ */

const SUPABASE_URL  = '${url}';
const SUPABASE_ANON = '${anon}';
`;

const configPath = path.join(__dirname, 'js/config.js');

const dir = path.dirname(configPath);
if (!fs.existsSync(dir)){
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(configPath, content, 'utf8');
console.log('Generated js/config.js successfully!');
