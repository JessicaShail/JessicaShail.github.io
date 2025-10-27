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

// Check if guest already RSVP'd by email or guest name
const checkExistingRsvp = async (client, guestName) => {
  const query = 'SELECT id, guest_name, partner_name FROM rsvps WHERE LOWER(guest_name) = LOWER($1) OR LOWER(partner_name) = LOWER($1)';
  console.log(`🔍 Executing duplicate check query with: name: "${guestName}"`);
  
  const result = await client.query(query, [guestName]);
  console.log(`🔍 Query returned ${result.rows.length} rows:`, result.rows);
  
  if (result.rows.length > 0) {
    const existingRsvp = result.rows[0];
    const response = {
      exists: true,
      byName: existingRsvp.guest_name.toLowerCase() === guestName.toLowerCase(),
    };
    console.log('🔍 Duplicate found, response:', response);
    return response;
  }
  
  console.log('🔍 No duplicates found');
  return { exists: false };
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
      'song-requests': data['song-requests'],
      advice: data.advice,
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

    // Check if already RSVP'd by email or name
    console.log(`🔍 Checking for existing RSVP - Name: ${rsvpData.guestName}`);
    const existingRsvpCheck = await checkExistingRsvp(client, rsvpData.guestName);
    console.log('🔍 Existing RSVP check result:', existingRsvpCheck);
    
    if (existingRsvpCheck.exists) {
      if (existingRsvpCheck.byName) {
        // Same name is trying to RSVP again - show friendly message
        return {
          statusCode: 200, // Use 200 status for friendly message
          headers,
          body: JSON.stringify({ 
            success: false,
            friendlyDuplicate: true,
            message: `Good to see you again, ${guestValidation.guest_name}! We've already received your RSVP and the system should have sent you a confirmation email. Let us know if you're having any issues.`,
            field: 'guestName'
          })
        };
      } else {
        // Different name but same email
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ 
            error: 'An RSVP has already been submitted with this email address. Please contact us if you need to make changes.',
            field: 'email'
          })
        };
      }
    }

    // Check if at least one person is attending at least one event
    const hasEventSelected = rsvpData.mehndiAttending === 'yes' || 
                           rsvpData.ceremonyAttending === 'yes' || 
                           rsvpData.receptionAttending === 'yes' ||
                           rsvpData.partnerMehndiAttending === 'yes' ||
                           rsvpData.partnerCeremonyAttending === 'yes' ||
                           rsvpData.partnerReceptionAttending === 'yes';
    
    // Set partner name from guest validation if not provided
    if (guestValidation.partner_name && !rsvpData.partnerName) {
      rsvpData.partnerName = guestValidation.partner_name;
    }

    // Insert RSVP
    const rsvpId = await insertRsvp(client, rsvpData);

    // Send confirmation email via EmailJS
    try {
      // Check if EmailJS environment variables are configured
      const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
      const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
      const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
      
      console.log('EmailJS Config Check:', {
        hasPublicKey: !!emailjsPublicKey,
        hasServiceId: !!emailjsServiceId,
        hasTemplateId: !!emailjsTemplateId
      });

      if (emailjsPublicKey && emailjsServiceId && emailjsTemplateId) {
        
        // Prepare email template parameters
        const templateParams = {
          guest_name: guestValidation.guest_name,
          guest_email: rsvpData.email,
          partner_name: rsvpData.partnerName || '',
          mehndi_attending: rsvpData.mehndiAttending || 'no',
          ceremony_attending: rsvpData.ceremonyAttending || 'no',
          reception_attending: rsvpData.receptionAttending || 'no',
          partner_mehndi_attending: rsvpData.partnerMehndiAttending || 'no',
          partner_ceremony_attending: rsvpData.partnerCeremonyAttending || 'no',
          partner_reception_attending: rsvpData.partnerReceptionAttending || 'no',
          dietary_restrictions: rsvpData.dietary || '',
          song_requests: rsvpData['song-requests'] || '',
          advice: rsvpData.advice || '',
          special_message: rsvpData.message || '',
          reply_to: rsvpData.email
        };

        console.log('Attempting to send email via EmailJS to:', rsvpData.email);
        // Send email using EmailJS REST API
        const emailPayload = {
          service_id: emailjsServiceId,
          template_id: emailjsTemplateId,
          user_id: emailjsPublicKey,
          template_params: templateParams
        };

        console.log('EmailJS payload prepared, making API call...');

        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload)
        });

        console.log('EmailJS API response status:', emailResponse.status);

        if (emailResponse.ok) {
          console.log(`✅ Confirmation email sent successfully to ${rsvpData.email} via EmailJS`);
        } else {
          const errorText = await emailResponse.text();
          console.error('❌ EmailJS API error:', {
            status: emailResponse.status,
            statusText: emailResponse.statusText,
            errorBody: errorText
          });
        }
      } else {
        console.log('❌ EmailJS not fully configured - missing environment variables');
        console.log('Missing variables:', {
          EMAILJS_PUBLIC_KEY: !emailjsPublicKey,
          EMAILJS_SERVICE_ID: !emailjsServiceId,
          EMAILJS_TEMPLATE_ID: !emailjsTemplateId
        });
      }
    } catch (emailError) {
      console.error('❌ Exception during email sending:', emailError);
      console.error('Email error stack:', emailError.stack);
      // Don't fail the RSVP if email fails - just log it
    }

    // Determine if anyone is attending any event
    const isAnyoneAttending = rsvpData.mehndiAttending === 'yes' || 
                            rsvpData.ceremonyAttending === 'yes' || 
                            rsvpData.receptionAttending === 'yes' ||
                            rsvpData.partnerMehndiAttending === 'yes' ||
                            rsvpData.partnerCeremonyAttending === 'yes' ||
                            rsvpData.partnerReceptionAttending === 'yes';

    const successMessage = isAnyoneAttending 
      ? `Thank you for your RSVP!`
      : `Thank you for your RSVP!`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
  message: successMessage,
        rsvpId: rsvpId,
        emailDebug: process.env.NODE_ENV === 'development' ? {
          hasEmailJsKeys: !!(process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID),
          publicKey: process.env.EMAILJS_PUBLIC_KEY ? 'SET' : 'MISSING',
          serviceId: process.env.EMAILJS_SERVICE_ID ? 'SET' : 'MISSING',
          templateId: process.env.EMAILJS_TEMPLATE_ID ? 'SET' : 'MISSING'
        } : undefined
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
