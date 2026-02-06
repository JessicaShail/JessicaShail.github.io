// Netlify Function for guest list autocomplete
const { createDbClient } = require('./db');

// Database connection
const getDbClient = () => {
  const connectionString = process.env.NETLIFY_DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('NETLIFY_DATABASE_URL environment variable is not set');
  }
  
  return createDbClient({
    // Add connection timeout settings
    connectionTimeoutMillis: 10000,
    query_timeout: 10000
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

  // Check if environment variable exists
  if (!process.env.NETLIFY_DATABASE_URL) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Database configuration missing',
        details: 'NETLIFY_DATABASE_URL environment variable is not set'
      })
    };
  }

  let client;
  
  try {
    client = getDbClient();
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Database client initialization failed',
        details: error.message
      })
    };
  }
  
  try {
    console.log('Attempting to connect to database...');
    await client.connect();
    console.log('Database connection successful');
    
    // Get search query from URL parameters
    const searchQuery = event.queryStringParameters?.q || '';
    
    let query, params;
    
    if (searchQuery) {
      // Search for guests matching the query in both guest_name and partner_name
      // Only show guests whose invitation date has passed
      const normalizedQuery = searchQuery.toLowerCase().trim();
      query = `
        SELECT guest_name, partner_name, max_guests, tier, invitation_date
        FROM guest_list 
        WHERE (LOWER(guest_name) ILIKE $1 OR LOWER(partner_name) ILIKE $1)
        AND invitation_date <= CURRENT_DATE
        ORDER BY 
          CASE 
            WHEN LOWER(guest_name) LIKE $2 THEN 1 
            WHEN LOWER(partner_name) LIKE $2 THEN 2
            WHEN LOWER(guest_name) LIKE $3 THEN 3 
            WHEN LOWER(partner_name) LIKE $3 THEN 4
            ELSE 5 
          END,
          tier,
          guest_name
        LIMIT 20
      `;
      params = [
        `%${normalizedQuery}%`,
        `${normalizedQuery}%`,
        `%${normalizedQuery}%`
      ];
    } else {
      // Return all guests whose invitation date has passed if no search query
      query = `
        SELECT guest_name, partner_name, max_guests, tier, invitation_date 
        FROM guest_list 
        WHERE invitation_date <= CURRENT_DATE 
        ORDER BY tier, guest_name 
        LIMIT 50
      `;
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
    if (client) {
      try {
        await client.end();
      } catch (error) {
        console.error('Error closing database connection:', error);
      }
    }
  }
};
