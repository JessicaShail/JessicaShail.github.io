// Netlify Function: Get registry enabled flag
// Priority: if REGISTRY_ENABLED env var is set, use it. Otherwise read from DB site_settings table.
const { Client } = require('pg');

const getDbClient = () => new Client({ connectionString: process.env.NETLIFY_DATABASE_URL, ssl: { rejectUnauthorized: false } });

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };

  // If environment variable is explicitly set in Netlify, prefer it
  if (typeof process.env.REGISTRY_ENABLED !== 'undefined') {
    const v = String(process.env.REGISTRY_ENABLED).toLowerCase();
    const enabled = (v === '1' || v === 'true' || v === 'yes');
    return { statusCode: 200, headers, body: JSON.stringify({ enabled, source: 'env' }) };
  }

  // Fallback to DB-stored setting
  const client = getDbClient();
  try {
    await client.connect();
    // Ensure table exists
    await client.query(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)`);
    const res = await client.query(`SELECT value FROM site_settings WHERE key = $1 LIMIT 1`, ['registry_enabled']);
    if (res.rows.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ enabled: false, source: 'db' }) };
    }
    const v = (res.rows[0].value || '').toLowerCase();
    const enabled = (v === '1' || v === 'true' || v === 'yes');
    return { statusCode: 200, headers, body: JSON.stringify({ enabled, source: 'db' }) };
  } catch (err) {
    console.error('get-registry-flag error', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    try { await client.end(); } catch (e){}
  }
};
