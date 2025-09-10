// Netlify Function for RSVP analytics (admin only)
const { Client } = require('pg');

const getDbClient = () => {
  return new Client({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
};

// Simple admin authentication
const isAuthorized = (event) => {
  const authHeader = event.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Set this in Netlify env vars
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === adminPassword;
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check authorization
  if (!isAuthorized(event)) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const client = getDbClient();

  try {
    await client.connect();
    
    // Get summary statistics
    const summaryQuery = 'SELECT * FROM rsvp_summary';
    const summaryResult = await client.query(summaryQuery);
    
    // Get all RSVPs with details
    const rsvpsQuery = `
      SELECT 
        id, guest_name, email, phone,
        mehndi_attending, mehndi_guests,
        ceremony_attending, ceremony_guests,
        reception_attending, reception_guests,
        dietary_restrictions, special_message,
        created_at
      FROM rsvps 
      ORDER BY created_at DESC
    `;
    const rsvpsResult = await client.query(rsvpsQuery);

    // Get guest list stats
    const guestListQuery = 'SELECT COUNT(*) as total_invited FROM guest_list';
    const guestListResult = await client.query(guestListQuery);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary: summaryResult.rows[0],
        rsvps: rsvpsResult.rows,
        totalInvited: parseInt(guestListResult.rows[0].total_invited),
        responseRate: Math.round((summaryResult.rows[0].total_rsvps / parseInt(guestListResult.rows[0].total_invited)) * 100)
      })
    };

  } catch (error) {
    console.error('Error fetching RSVP stats:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error fetching statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  } finally {
    await client.end();
  }
};

