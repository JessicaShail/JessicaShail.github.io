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

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!checkAdmin(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const data = JSON.parse(event.body);
  const { id, title, description, imageUrl, price, quantity, purchaseUrl } = data;
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };

  const client = getDbClient();
  try {
    await client.connect();
    const fields = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (imageUrl !== undefined) { fields.push(`image_url = $${idx++}`); values.push(imageUrl); }
    if (price !== undefined) { fields.push(`price = $${idx++}`); values.push(price); }
    if (quantity !== undefined) { fields.push(`quantity = $${idx++}`); values.push(quantity); }
    if (purchaseUrl !== undefined) { fields.push(`purchase_url = $${idx++}`); values.push(purchaseUrl); }

    if (!fields.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'no fields to update' }) };

    const query = `UPDATE gifts SET ${fields.join(',')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
    values.push(id);

    const res = await client.query(query, values);
    if (!res.rows.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

    return { statusCode: 200, headers, body: JSON.stringify({ gift: res.rows[0] }) };
  } catch (err) {
    console.error('update-gift error', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    await client.end();
  }
};
