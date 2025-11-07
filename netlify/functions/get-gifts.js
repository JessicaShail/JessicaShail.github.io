const { Client } = require('pg');

const getDbClient = () => new Client({
  connectionString: process.env.NETLIFY_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const eventId = event.queryStringParameters && event.queryStringParameters.eventId;

  const client = getDbClient();
  try {
    await client.connect();

    const query = eventId ? 'SELECT * FROM gifts WHERE event_id = $1 ORDER BY id' : 'SELECT * FROM gifts ORDER BY id';
    const params = eventId ? [eventId] : [];

    const res = await client.query(query, params);
    return { statusCode: 200, headers, body: JSON.stringify({ gifts: res.rows }) };
  } catch (err) {
    console.error('get-gifts error', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    await client.end();
  }
};
