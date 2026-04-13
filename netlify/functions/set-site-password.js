// Netlify Function: Set (or update) the site password
// Admin-only. Accepts POST { password: string }, hashes with SHA-256, upserts into site_settings.
// Usage: POST /.netlify/functions/set-site-password
//   Header: Authorization: Bearer <ADMIN_PASSWORD>
//   Body:   { "password": "new-site-password" }
const crypto = require('crypto');
const { createDbClient } = require('./db');

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

const checkAdmin = (event) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const auth = (event.headers['authorization'] || event.headers['Authorization'] || '');
  if (!auth.startsWith('Bearer ')) return false;
  return auth.slice(7) === adminPassword;
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://chalowedding.ca',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!checkAdmin(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { password } = body;
  if (!password || typeof password !== 'string' || password.length < 6) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'password must be at least 6 characters' }) };
  }

  const hash = sha256(password);
  const client = createDbClient();
  try {
    await client.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)`);
    await client.query(
      `INSERT INTO site_settings (key, value) VALUES ('site_password_hash', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [hash]
    );
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('set-site-password error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    try { await client.end(); } catch (e) {}
  }
};
