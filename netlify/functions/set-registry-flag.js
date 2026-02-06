// Netlify Function: Set registry enabled flag (admin only)
// This will upsert the 'registry_enabled' key in site_settings table.
// If a Netlify env var REGISTRY_ENABLED is present, it will still take precedence when reading.
const { Client } = require('pg');

const getDbClient = () => new Client({ connectionString: process.env.NETLIFY_DATABASE_URL, ssl: { rejectUnauthorized: false } });

const isAuthorized = (event) => {
  const auth = event.headers && (event.headers.authorization || event.headers.Authorization);
  return auth && auth === (process.env.GIFT_ADMIN_SECRET || '');
};

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  if (!isAuthorized(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const enabled = payload.enabled === true || payload.enabled === 'true' || payload.enabled === 1 || payload.enabled === '1';

  const client = getDbClient();
  try {
    await client.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)`);
    const upsert = `INSERT INTO site_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    await client.query(upsert, ['registry_enabled', enabled ? 'true' : 'false']);

    // NOTE: If you want the flag to be controlled via Netlify environment variables,
    // set REGISTRY_ENABLED in your Netlify site settings. This function persists the
    // admin toggle to the DB. The read function will prefer the Netlify env var when present.

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, enabled }) };
  } catch (err) {
    console.error('set-registry-flag error', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    try { await client.end(); } catch (e){}
  }
};
