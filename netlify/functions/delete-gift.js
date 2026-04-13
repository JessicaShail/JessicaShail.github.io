const { createDbClient } = require('./db');

const getDbClient = () => createDbClient();

const checkAdmin = (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const token = (event.headers && (event.headers['authorization'] || event.headers['Authorization'])) || body.adminSecret;
  return token && token === process.env.GIFT_ADMIN_SECRET;
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://chalowedding.ca',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body); } catch(e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
  const { id } = body;
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };

  const client = getDbClient();
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM gift_reservations WHERE gift_id = $1', [id]);
    const res = await client.query('DELETE FROM gifts WHERE id = $1 RETURNING *', [id]);
    await client.query('COMMIT');
    if (!res.rows.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('delete-gift error', err);
    try { await client.query('ROLLBACK'); } catch(e) {}
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    await client.end();
  }
};
