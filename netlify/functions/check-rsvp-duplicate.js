// Netlify Function: Check RSVP Duplicate by Guest Name
const { Client } = require('pg');

const getDbClient = () => {
  return new Client({
    connectionString: process.env.NETLIFY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const guestName = (event.queryStringParameters && event.queryStringParameters.guestName) || '';
  if (!guestName || !guestName.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'guestName is required' }) };
  }

  const client = getDbClient();
  try {
    await client.connect();

    const query = `
      SELECT id, guest_name, partner_name
      FROM rsvps
      WHERE LOWER(guest_name) = LOWER($1)
         OR LOWER(partner_name) = LOWER($1)
      LIMIT 1
    `;
    const result = await client.query(query, [guestName.trim()]);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const nameMatched = (row.guest_name || '').toLowerCase() === guestName.trim().toLowerCase();
      const message = `Good to see you again, ${row.guest_name || guestName}! We've already received your RSVP. If you need to make a change, please contact us.`;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ exists: true, byName: nameMatched, message })
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ exists: false }) };
  } catch (err) {
    console.error('Duplicate check error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    await client.end();
  }
};
