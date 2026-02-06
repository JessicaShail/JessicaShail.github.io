const { createDbClient } = require('./db');

const getDbClient = () => createDbClient();

// Allow cancellation by admin-secret or by reservation id + reserverEmail match
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

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { reservationId, reserverEmail } = body;
  if (!reservationId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'reservationId required' }) };

  const client = getDbClient();
  try {
    await client.connect();
    await client.query('BEGIN');

    const reservationRes = await client.query('SELECT * FROM gift_reservations WHERE id = $1 FOR UPDATE', [reservationId]);
    if (!reservationRes.rows.length) { await client.query('ROLLBACK'); return { statusCode: 404, headers, body: JSON.stringify({ error: 'Reservation not found' }) }; }

    const reservation = reservationRes.rows[0];

    // Check permission: either admin or matching email
    if (!checkAdmin(event)) {
      if (!reserverEmail || reserverEmail !== reservation.reserver_email) {
        await client.query('ROLLBACK');
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }
    }

    if (reservation.cancelled) { await client.query('ROLLBACK'); return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already cancelled' }) }; }

    // decrement reserved_count on gifts
    await client.query('UPDATE gifts SET reserved_count = GREATEST(reserved_count - $1, 0), updated_at = now() WHERE id = $2', [reservation.qty, reservation.gift_id]);

    await client.query('UPDATE gift_reservations SET cancelled = true, cancelled_at = now() WHERE id = $1', [reservationId]);

    await client.query('COMMIT');
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('cancel-reservation error', err);
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    await client.end();
  }
};
