// Netlify Function for RSVP submission
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

// Guest list validation
const validateGuest = async (client, guestName) => {
  const normalizedInput = guestName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  
  const query = `
    SELECT guest_name, max_guests 
    FROM guest_list 
    WHERE LOWER(REPLACE(REGEXP_REPLACE(guest_name, '[^\\w\\s]', '', 'g'), ' ', ' ')) 
    ILIKE $1 
    OR LOWER(REPLACE(REGEXP_REPLACE(guest_name, '[^\\w\\s]', '', 'g'), ' ', ' ')) 
    ILIKE '%' || $1 || '%'
    OR $1 ILIKE '%' || LOWER(REPLACE(REGEXP_REPLACE(guest_name, '[^\\w\\s]', '', 'g'), ' ', ' ')) || '%'
    LIMIT 1
  `;
  
  const result = await client.query(query, [normalizedInput]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

// Check if guest already RSVP'd
const checkExistingRsvp = async (client, email) => {
  const query = 'SELECT id FROM rsvps WHERE email = $1';
  const result = await client.query(query, [email]);
  return result.rows.length > 0;
};

// Insert RSVP
const insertRsvp = async (client, rsvpData) => {
  const query = `
    INSERT INTO rsvps (
      guest_name, email, phone,
      mehndi_attending, mehndi_guests,
      ceremony_attending, ceremony_guests,
      reception_attending, reception_guests,
      dietary_restrictions, special_message,
      ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
  `;
  
  const values = [
    rsvpData.guestName,
    rsvpData.email,
    rsvpData.phone || null,
    rsvpData.mehndiAttending === 'yes',
    parseInt(rsvpData.mehndiGuests) || 0,
    rsvpData.ceremonyAttending === 'yes',
    parseInt(rsvpData.ceremonyGuests) || 0,
    rsvpData.receptionAttending === 'yes',
    parseInt(rsvpData.receptionGuests) || 0,
    rsvpData.dietary || null,
    rsvpData.message || null,
    rsvpData.ipAddress,
    rsvpData.userAgent
  ];
  
  const result = await client.query(query, values);
  return result.rows[0].id;
};

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const client = getDbClient();

  try {
    await client.connect();
    
    // Parse request body
    const data = JSON.parse(event.body);
    
    // Extract client info
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';
    
    const rsvpData = {
      guestName: data.guestName,
      email: data.email,
      phone: data.phone,
      mehndiAttending: data['mehndi-attending'],
      mehndiGuests: data['mehndi-guests'],
      ceremonyAttending: data['ceremony-attending'],
      ceremonyGuests: data['ceremony-guests'],
      receptionAttending: data['reception-attending'],
      receptionGuests: data['reception-guests'],
      dietary: data.dietary,
      message: data.message,
      ipAddress: clientIP,
      userAgent: userAgent
    };

    // Validation
    if (!rsvpData.guestName || !rsvpData.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Name and email are required',
          field: 'guestName'
        })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rsvpData.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Please enter a valid email address',
          field: 'email'
        })
      };
    }

    // Check if guest is on the guest list
    const guestValidation = await validateGuest(client, rsvpData.guestName);
    if (!guestValidation) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          error: `We couldn't find "${rsvpData.guestName}" on our guest list. Please check the spelling or contact us if you believe this is an error.`,
          field: 'guestName'
        })
      };
    }

    // Check if already RSVP'd
    const alreadyRsvpd = await checkExistingRsvp(client, rsvpData.email);
    if (alreadyRsvpd) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          error: 'An RSVP has already been submitted with this email address. Please contact us if you need to make changes.',
          field: 'email'
        })
      };
    }

    // Check if at least one event is selected
    const hasEventSelected = rsvpData.mehndiAttending === 'yes' || 
                           rsvpData.ceremonyAttending === 'yes' || 
                           rsvpData.receptionAttending === 'yes';
    
    if (!hasEventSelected) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Please select your attendance for at least one event.',
          field: 'events'
        })
      };
    }

    // Insert RSVP
    const rsvpId = await insertRsvp(client, rsvpData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: `Thank you, ${guestValidation.guest_name}! Your RSVP has been received.`,
        rsvpId: rsvpId
      })
    };

  } catch (error) {
    console.error('RSVP submission error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'There was an error processing your RSVP. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  } finally {
    await client.end();
  }
};
