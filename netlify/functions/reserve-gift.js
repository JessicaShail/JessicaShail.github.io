const { createDbClient } = require('./db');

const getDbClient = () => createDbClient();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { giftId, reserverName, reserverEmail, qty = 1, note } = body;
  if (!giftId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'giftId required' }) };
  if (qty <= 0) return { statusCode: 400, headers, body: JSON.stringify({ error: 'qty must be >= 1' }) };

  const client = getDbClient();
  try {
    await client.connect();
    // Use a transaction and SELECT ... FOR UPDATE to ensure atomicity
    await client.query('BEGIN');

    const selectRes = await client.query('SELECT quantity, reserved_count FROM gifts WHERE id = $1 FOR UPDATE', [giftId]);
    if (!selectRes.rows.length) {
      await client.query('ROLLBACK');
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Gift not found' }) };
    }

    const { quantity, reserved_count } = selectRes.rows[0];
    const available = quantity - reserved_count;
    if (available < qty) {
      await client.query('ROLLBACK');
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Not enough quantity available', available }) };
    }

    const newReserved = reserved_count + qty;
    await client.query('UPDATE gifts SET reserved_count = $1, updated_at = now() WHERE id = $2', [newReserved, giftId]);

    const insertRes = await client.query(
      `INSERT INTO gift_reservations (gift_id, reserver_name, reserver_email, reserver_note, qty) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [giftId, reserverName || null, reserverEmail || null, note || null, qty]
    );

    await client.query('COMMIT');

    // TODO: send confirmation email (owner + reserver) optionally

    return { statusCode: 201, headers, body: JSON.stringify({ reservation: insertRes.rows[0], remaining: quantity - newReserved }) };
  } catch (err) {
    console.error('reserve-gift error', err);
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    await client.end();
  }
};
