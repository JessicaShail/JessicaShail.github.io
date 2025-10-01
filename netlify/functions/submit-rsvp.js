// Netlify Function for RSVP submission
const { Client } = require('pg');
const { createRsvpConfirmationEmail } = require('./email-templates');

// Database connection
const getDbClient = () => {
  return new Client({
    connectionString: process.env.NETLIFY_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
};

// Guest list validation with tier checking
const validateGuest = async (client, guestName) => {
  const normalizedInput = guestName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  
  // First check if guest exists at all
  const existsQuery = `
    SELECT guest_name, partner_name, max_guests, tier, invitation_date
    FROM guest_list 
    WHERE LOWER(REPLACE(REGEXP_REPLACE(guest_name, '[^\\w\\s]', '', 'g'), ' ', ' ')) 
    ILIKE $1 
    OR LOWER(REPLACE(REGEXP_REPLACE(guest_name, '[^\\w\\s]', '', 'g'), ' ', ' ')) 
    ILIKE '%' || $1 || '%'
    OR $1 ILIKE '%' || LOWER(REPLACE(REGEXP_REPLACE(guest_name, '[^\\w\\s]', '', 'g'), ' ', ' ')) || '%'
    LIMIT 1
  `;
  
  const existsResult = await client.query(existsQuery, [normalizedInput]);
  
  if (existsResult.rows.length === 0) {
    return null; // Guest not found at all
  }
  
  const guest = existsResult.rows[0];
  
  // Check if invitation date has passed
  if (new Date(guest.invitation_date) > new Date()) {
    return {
      ...guest,
      notYetAvailable: true,
      availableDate: guest.invitation_date
    };
  }
  
  return guest; // Guest is available for RSVP
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
      mehndi_attending,
      ceremony_attending,
      reception_attending,
      partner_name,
      partner_mehndi_attending,
      partner_ceremony_attending,
      partner_reception_attending,
      dietary_restrictions, song_requests, advice, special_message,
      ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING id
  `;
  
  const values = [
    rsvpData.guestName,
    rsvpData.email,
    rsvpData.phone || null,
    rsvpData.mehndiAttending === 'yes',
    rsvpData.ceremonyAttending === 'yes',
    rsvpData.receptionAttending === 'yes',
    rsvpData.partnerName || null,
    rsvpData.partnerMehndiAttending === 'yes',
    rsvpData.partnerCeremonyAttending === 'yes',
    rsvpData.partnerReceptionAttending === 'yes',
    rsvpData.dietary || null,
    rsvpData['song-requests'] || null,
    rsvpData.advice || null,
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
      partnerName: data.partnerName,
      partnerMehndiAttending: data['mehndi-partner-attending'],
      partnerCeremonyAttending: data['ceremony-partner-attending'],
      partnerReceptionAttending: data['reception-partner-attending'],
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

    // Check if guest's invitation is available yet (tier system)
    if (guestValidation.notYetAvailable) {
      const availableDate = new Date(guestValidation.availableDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          error: `Hi ${guestValidation.guest_name}! Your RSVP will be available starting ${availableDate}. Please check back then to submit your response.`,
          field: 'guestName',
          availableDate: guestValidation.availableDate,
          tier: guestValidation.tier
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

    // Check if at least one person is attending at least one event
    const hasEventSelected = rsvpData.mehndiAttending === 'yes' || 
                           rsvpData.ceremonyAttending === 'yes' || 
                           rsvpData.receptionAttending === 'yes' ||
                           rsvpData.partnerMehndiAttending === 'yes' ||
                           rsvpData.partnerCeremonyAttending === 'yes' ||
                           rsvpData.partnerReceptionAttending === 'yes';
    
    if (!hasEventSelected) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Please select attendance for at least one person at one event.',
          field: 'events'
        })
      };
    }
    
    // Set partner name from guest validation if not provided
    if (guestValidation.partner_name && !rsvpData.partnerName) {
      rsvpData.partnerName = guestValidation.partner_name;
    }

    // Insert RSVP
    const rsvpId = await insertRsvp(client, rsvpData);

    // Note: Email sending will be handled by frontend using EmailJS
    // This reduces backend complexity and allows using personal email accounts
    console.log('RSVP saved successfully - email will be sent via frontend');

    // Determine if anyone is attending any event
    const isAnyoneAttending = rsvpData.mehndiAttending === 'yes' || 
                            rsvpData.ceremonyAttending === 'yes' || 
                            rsvpData.receptionAttending === 'yes' ||
                            rsvpData.partnerMehndiAttending === 'yes' ||
                            rsvpData.partnerCeremonyAttending === 'yes' ||
                            rsvpData.partnerReceptionAttending === 'yes';

    const successMessage = isAnyoneAttending 
      ? `Thank you for your RSVP! We look forward to seeing you in May!`
      : `Thank you for your RSVP! We will miss you but we look forward to celebrating with you soon!`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: `Thank you, ${guestValidation.guest_name}! ${successMessage}`,
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
        details: error.message
      })
    };
  } finally {
    await client.end();
  }
};
