// Netlify Function to return guests who have RSVP'd 'yes' to any event
const { Client } = require('pg');

// Database connection helper (matches existing pattern)
const getDbClient = () => {
  const connectionString = process.env.NETLIFY_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NETLIFY_DATABASE_URL environment variable is not set');
  }
  return new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    sslmode: 'require'
  });
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.NETLIFY_DATABASE_URL) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Database configuration missing' })
    };
  }

  let client;
  try {
    client = getDbClient();
  } catch (error) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }

  try {
    await client.connect();

    const q = (event.queryStringParameters && event.queryStringParameters.q) ? event.queryStringParameters.q.trim() : '';

    // We want guests who have RSVP'd 'yes' for any primary or partner attendance
    // Join guest_list to rsvps to get canonical guest_name and partner_name
    let queryText;
    let params = [];

    if (q) {
      const normalized = `%${q.toLowerCase()}%`;
      queryText = `
        SELECT r.guest_name, r.email, r.partner_name,
               r.mehndi_attending, r.ceremony_attending, r.reception_attending,
               r.partner_mehndi_attending, r.partner_ceremony_attending, r.partner_reception_attending,
               gl.id as guest_list_id, gl.max_guests
        FROM rsvps r
        LEFT JOIN guest_list gl ON LOWER(TRIM(gl.guest_name)) = LOWER(TRIM(r.guest_name))
        WHERE (
          COALESCE(r.mehndi_attending, false)
          OR COALESCE(r.ceremony_attending, false)
          OR COALESCE(r.reception_attending, false)
          OR COALESCE(r.partner_mehndi_attending, false)
          OR COALESCE(r.partner_ceremony_attending, false)
          OR COALESCE(r.partner_reception_attending, false)
        )
        AND (
          LOWER(r.guest_name) ILIKE $1 OR LOWER(r.email) ILIKE $1 OR LOWER(r.partner_name) ILIKE $1
        )
        ORDER BY r.guest_name
        LIMIT 100
      `;
      params = [normalized];
    } else {
      queryText = `
        SELECT r.guest_name, r.email, r.partner_name,
               r.mehndi_attending, r.ceremony_attending, r.reception_attending,
               r.partner_mehndi_attending, r.partner_ceremony_attending, r.partner_reception_attending,
               gl.id as guest_list_id, gl.max_guests
        FROM rsvps r
        LEFT JOIN guest_list gl ON LOWER(TRIM(gl.guest_name)) = LOWER(TRIM(r.guest_name))
        WHERE (
          COALESCE(r.mehndi_attending, false)
          OR COALESCE(r.ceremony_attending, false)
          OR COALESCE(r.reception_attending, false)
          OR COALESCE(r.partner_mehndi_attending, false)
          OR COALESCE(r.partner_ceremony_attending, false)
          OR COALESCE(r.partner_reception_attending, false)
        )
        ORDER BY r.guest_name
        LIMIT 200
      `;
      params = [];
    }

    const res = await client.query(queryText, params);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, guests: res.rows })
    };

  } catch (error) {
    console.error('Error in get-attending-guests:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Database error', details: error.message })
    };
  } finally {
    if (client) {
      try { await client.end(); } catch (e) { console.error('Error closing client', e); }
    }
  }
};
