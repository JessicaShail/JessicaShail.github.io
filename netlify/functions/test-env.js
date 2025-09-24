// Test environment variables
exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      hasNeonUrl: !!process.env.NEON_DATABASE_URL,
      urlLength: process.env.NEON_DATABASE_URL ? process.env.NEON_DATABASE_URL.length : 0,
      urlPrefix: process.env.NEON_DATABASE_URL ? process.env.NEON_DATABASE_URL.substring(0, 20) + '...' : 'Not set',
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    })
  };
};
