// Netlify Function: Verify site password
// Accepts POST { password: string }, hashes with SHA-256, compares against:
//   1. site_settings row (key = 'site_password_hash') — primary source
//   2. SITE_PASSWORD_HASH env var — fallback for initial bootstrap
const crypto = require('crypto');
const { createDbClient } = require('./db');

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://chalowedding.ca',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ verified: false }) };
  }

  const { password } = body;
  if (!password || typeof password !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ verified: false }) };
  }

  // Try to read hash from database
  let storedHash = null;
  const client = createDbClient();
  try {
    await client.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)`);
    const result = await client.query(
      `SELECT value FROM site_settings WHERE key = 'site_password_hash' LIMIT 1`
    );
    if (result.rows.length > 0) {
      storedHash = result.rows[0].value;
    }
  } catch (err) {
    console.error('verify-password: DB error:', err.message);
    // Fall through to env var below
  } finally {
    try { await client.end(); } catch (e) {}
  }

  // Fall back to env var if not set in DB (useful for initial bootstrap)
  if (!storedHash) {
    storedHash = process.env.SITE_PASSWORD_HASH || null;
  }

  if (!storedHash) {
    console.error('verify-password: no password hash configured (set SITE_PASSWORD_HASH env var or use set-site-password function)');
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Password verification not configured' }) };
  }

  const inputHash = sha256(password);
  const verified = inputHash === storedHash;

  // Always return 200 so the caller doesn't know which branch fails
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ verified })
  };
};
