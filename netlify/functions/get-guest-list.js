// Netlify Function for guest list autocomplete
const { Client } = require('pg');

// Database connection
const getDbClient = () => {
  return new Client({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const client = getDbClient();
  
  try {
    await client.connect();
    
    // Get search query from URL parameters
    const searchQuery = event.queryStringParameters?.q || '';
    
    let query, params;
    
    if (searchQuery) {
      // Search for guests matching the query
      const normalizedQuery = searchQuery.toLowerCase().trim();
      query = `
        SELECT guest_name, partner_name, max_guests 
        FROM guest_list 
        WHERE LOWER(guest_name) ILIKE $1
        ORDER BY 
          CASE 
            WHEN LOWER(guest_name) LIKE $2 THEN 1 
            WHEN LOWER(guest_name) LIKE $3 THEN 2 
            ELSE 3 
          END,
          guest_name
        LIMIT 20
      `;
      params = [
        `%${normalizedQuery}%`,
        `${normalizedQuery}%`,
        `%${normalizedQuery}%`
      ];
    } else {
      // Return all guests if no search query
      query = 'SELECT guest_name, partner_name, max_guests FROM guest_list ORDER BY guest_name LIMIT 50';
      params = [];
    }
    
    const result = await client.query(query, params);
    
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        guests: result.rows
      })
    };
    
  } catch (error) {
    console.error('Database error:', error);
    
    // More detailed error information for debugging
    const errorDetails = {
      message: error.message,
      code: error.code,
      hasConnectionString: !!process.env.NEON_DATABASE_URL,
      timestamp: new Date().toISOString()
    };
    
    console.error('Error details:', errorDetails);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch guest list',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      })
    };
    
  } finally {
    await client.end();
  }
};
