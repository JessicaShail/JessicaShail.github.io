/**
 * Netlify Function: Get Pending RSVPs
 * Returns a list of guests who haven't responded to their RSVP
 * 
 * Usage: GET /.netlify/functions/get-pending-rsvps
 * 
 * Headers:
 * - Authorization: Bearer <ADMIN_PASSWORD>
 * 
 * Query Parameters:
 * - urgency: Filter by urgency level (urgent, high, normal, all) - default: all
 * - invitedBy: Filter by who invited them - optional
 */

const { neon } = require('@neondatabase/serverless');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://chalowedding.ca';

const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

// Validate admin password from Authorization: Bearer header. Fails closed if env var not set.
function validateAdminPassword(event) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return false;
    const auth = (event.headers['authorization'] || event.headers['Authorization'] || '');
    if (!auth.startsWith('Bearer ')) return false;
    return auth.slice(7) === adminPassword;
}

exports.handler = async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Validate admin password from Authorization header
    if (!validateAdminPassword(event)) {
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Unauthorized',
                message: 'Invalid or missing Authorization header'
            })
        };
    }

    try {
        // Parse query parameters
        const params = event.queryStringParameters || {};
        const { urgency = 'all', invitedBy } = params;

        // Connect to database
        const sql = neon(process.env.DATABASE_URL);

        // Build query based on filters
        let query = `
            SELECT 
                id,
                guest_name,
                partner_name,
                invited_by,
                max_guests,
                notes,
                TO_CHAR(invited_at, 'YYYY-MM-DD') as invited_at,
                TO_CHAR(rsvp_deadline, 'YYYY-MM-DD') as rsvp_deadline,
                days_until_deadline,
                CASE 
                    WHEN days_until_deadline <= 7 THEN 'Urgent'
                    WHEN days_until_deadline <= 14 THEN 'High Priority'
                    WHEN days_until_deadline <= 30 THEN 'Normal'
                    ELSE 'Low Priority'
                END as urgency_level
            FROM pending_rsvps
            WHERE 1=1
        `;

        const queryParams = [];

        // Add urgency filter
        if (urgency !== 'all') {
            if (urgency === 'urgent') {
                query += ' AND days_until_deadline <= 7';
            } else if (urgency === 'high') {
                query += ' AND days_until_deadline <= 14';
            } else if (urgency === 'normal') {
                query += ' AND days_until_deadline <= 30';
            }
        }

        // Add invitedBy filter
        if (invitedBy) {
            queryParams.push(invitedBy);
            query += ` AND invited_by = $${queryParams.length}`;
        }

        // Order by urgency
        query += ' ORDER BY days_until_deadline ASC';

        // Execute query
        const pendingRsvps = await sql(query, queryParams);

        // Calculate summary statistics
        const summary = {
            total_pending: pendingRsvps.length,
            urgent: pendingRsvps.filter(r => r.urgency_level === 'Urgent').length,
            high_priority: pendingRsvps.filter(r => r.urgency_level === 'High Priority').length,
            normal: pendingRsvps.filter(r => r.urgency_level === 'Normal').length,
            low_priority: pendingRsvps.filter(r => r.urgency_level === 'Low Priority').length,
            overdue: pendingRsvps.filter(r => r.days_until_deadline < 0).length
        };

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Cache-Control': 'no-cache' },
            body: JSON.stringify({
                success: true,
                summary,
                pending_rsvps: pendingRsvps,
                filters_applied: {
                    urgency: urgency !== 'all' ? urgency : 'none',
                    invited_by: invitedBy || 'all'
                }
            })
        };

    } catch (error) {
        console.error('Error fetching pending RSVPs:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};


