// Netlify Function to expose EmailJS public configuration
// Note: Returns only the public key, service id and template id. Do not include any private/secret keys.

exports.handler = async (event) => {
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

  const publicKey = process.env.EMAILJS_PUBLIC_KEY || '';
  const serviceId = process.env.EMAILJS_SERVICE_ID || '';
  const templateId = process.env.EMAILJS_TEMPLATE_ID || '';

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ publicKey, serviceId, templateId })
  };
};
