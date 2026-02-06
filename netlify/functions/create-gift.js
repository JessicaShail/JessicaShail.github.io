const { createDbClient } = require('./db');
const crypto = require('crypto');

const getDbClient = () => createDbClient();

const checkAdmin = (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const token = (event.headers && (event.headers['authorization'] || event.headers['Authorization'])) || body.adminSecret;
  return token && token === process.env.GIFT_ADMIN_SECRET;
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!checkAdmin(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const data = JSON.parse(event.body);
  const { eventId, title, description, imageUrl, price, quantity = 1, purchaseUrl } = data;

  if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'title required' }) };

  const client = getDbClient();
  try {
    await client.connect();
    const res = await client.query(
      `INSERT INTO gifts (event_id, title, description, image_url, price, quantity, reserved_count, purchase_url) VALUES ($1,$2,$3,$4,$5,$6,0,$7) RETURNING *`,
      [eventId || null, title, description || null, imageUrl || null, price || null, quantity, purchaseUrl || null]
    );

    return { statusCode: 201, headers, body: JSON.stringify({ gift: res.rows[0] }) };
  } catch (err) {
    console.error('create-gift error', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    await client.end();
  }
};
