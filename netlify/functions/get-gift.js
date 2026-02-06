const { createDbClient } = require('./db');

const getDbClient = () => createDbClient();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };

  const client = getDbClient();
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM gifts WHERE id = $1', [id]);
    if (!res.rows.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ gift: res.rows[0] }) };
  } catch (err) {
    console.error('get-gift error', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  } finally {
    await client.end();
  }
};
