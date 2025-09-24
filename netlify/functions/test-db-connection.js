// Simple database connection test
const { Client } = require('pg');

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Check environment variable
  if (!process.env.NETLIFY_DATABASE_URL) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'NETLIFY_DATABASE_URL environment variable is not set'
      })
    };
  }

  const client = new Client({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Test basic connection
    await client.connect();
    
    // Test simple query
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    
    // Test if guest_list table exists
    const tableCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'guest_list'
    `);

    let guestCount = null;
    if (tableCheck.rows[0].count > 0) {
      const guestCountResult = await client.query('SELECT COUNT(*) as count FROM guest_list');
      guestCount = guestCountResult.rows[0].count;
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        connectionTest: 'passed',
        currentTime: result.rows[0].current_time,
        postgresVersion: result.rows[0].postgres_version,
        guestListTableExists: tableCheck.rows[0].count > 0,
        guestCount: guestCount,
        environmentCheck: {
          hasConnectionString: !!process.env.NEON_DATABASE_URL,
          connectionStringLength: process.env.NEON_DATABASE_URL ? process.env.NEON_DATABASE_URL.length : 0
        }
      })
    };

  } catch (error) {
    console.error('Database connection test failed:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Database connection failed',
        details: {
          message: error.message,
          code: error.code,
          hasConnectionString: !!process.env.NEON_DATABASE_URL,
          connectionStringPrefix: process.env.NEON_DATABASE_URL ? process.env.NEON_DATABASE_URL.substring(0, 15) + '...' : 'Not set'
        }
      })
    };

  } finally {
    try {
      await client.end();
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }
};
