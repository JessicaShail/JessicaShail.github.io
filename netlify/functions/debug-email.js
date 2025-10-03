// Temporary debugging function for EmailJS configuration
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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

  // Check EmailJS configuration
  const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
  const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
  const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
  
  console.log('=== EMAIL DEBUG ENDPOINT CALLED ===');
  console.log('EMAILJS_PUBLIC_KEY exists:', !!emailjsPublicKey);
  console.log('EMAILJS_SERVICE_ID exists:', !!emailjsServiceId);
  console.log('EMAILJS_TEMPLATE_ID exists:', !!emailjsTemplateId);
  
  if (emailjsPublicKey) console.log('Public key preview:', emailjsPublicKey.substring(0, 10) + '...');
  if (emailjsServiceId) console.log('Service ID preview:', emailjsServiceId.substring(0, 10) + '...');
  if (emailjsTemplateId) console.log('Template ID preview:', emailjsTemplateId.substring(0, 10) + '...');

  // Test EmailJS API connectivity
  let apiTest = null;
  try {
    console.log('Testing EmailJS API connectivity...');
    const testResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: 'test',
        template_id: 'test', 
        user_id: 'test',
        template_params: { test: 'test' }
      })
    });
    
    console.log('EmailJS API test response status:', testResponse.status);
    const testText = await testResponse.text();
    console.log('EmailJS API test response:', testText);
    
    apiTest = {
      status: testResponse.status,
      canReachAPI: true,
      response: testText.substring(0, 200) // Truncate for security
    };
  } catch (apiError) {
    console.error('EmailJS API test failed:', apiError);
    apiTest = {
      canReachAPI: false,
      error: apiError.message
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      debug: {
        environment: process.env.NODE_ENV || 'unknown',
        emailjs: {
          publicKey: emailjsPublicKey ? 'SET (' + emailjsPublicKey.length + ' chars)' : 'MISSING',
          serviceId: emailjsServiceId ? 'SET (' + emailjsServiceId.length + ' chars)' : 'MISSING',
          templateId: emailjsTemplateId ? 'SET (' + emailjsTemplateId.length + ' chars)' : 'MISSING',
          allConfigured: !!(emailjsPublicKey && emailjsServiceId && emailjsTemplateId)
        },
        apiTest: apiTest,
        timestamp: new Date().toISOString()
      }
    })
  };
};
