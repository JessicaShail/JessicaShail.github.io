/**
 * Netlify Function: Get RSVP Tracking
 * Returns comprehensive RSVP tracking information including both responded and pending guests
 * 
 * Usage: GET /.netlify/functions/get-rsvp-tracking
 * 
 * Headers:
 * - Authorization: Bearer <ADMIN_PASSWORD>
 * 
 * Query Parameters:
 * - status: Filter by RSVP status (pending, responded, late, all) - default: all
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
        const { status = 'all', invitedBy } = params;

        // Connect to database
        const sql = neon(process.env.DATABASE_URL);

        // Build query based on filters
        let query = `
            SELECT 
                guest_id,
                guest_name,
                partner_name,
                invited_by,
                max_guests,
                notes,
                TO_CHAR(invited_at, 'YYYY-MM-DD') as invited_at,
                rsvp_status,
                rsvp_id,
                email,
                phone,
                TO_CHAR(rsvp_received_at, 'YYYY-MM-DD HH24:MI:SS') as rsvp_received_at,
                mehndi_attending,
                mehndi_guests,
                ceremony_attending,
                ceremony_guests,
                reception_attending,
                reception_guests,
                rsvp_partner_name,
                partner_mehndi_attending,
                partner_ceremony_attending,
                partner_reception_attending,
                dietary_restrictions,
                special_message,
                TO_CHAR(rsvp_deadline, 'YYYY-MM-DD') as rsvp_deadline,
                days_since_rsvp
            FROM rsvp_tracking
            WHERE 1=1
        `;

        const queryParams = [];

        // Add status filter
        if (status !== 'all') {
            if (status === 'pending') {
                query += ` AND rsvp_status = 'Pending'`;
            } else if (status === 'responded') {
                query += ` AND rsvp_status = 'Responded'`;
            } else if (status === 'late') {
                query += ` AND rsvp_status = 'Late Response'`;
            }
        }

        // Add invitedBy filter
        if (invitedBy) {
            queryParams.push(invitedBy);
            query += ` AND invited_by = $${queryParams.length}`;
        }

        // Execute query
        const trackingData = await sql(query, queryParams);

        // Calculate comprehensive statistics
        const summary = {
            total_invited: trackingData.length,
            pending: trackingData.filter(r => r.rsvp_status === 'Pending').length,
            responded: trackingData.filter(r => r.rsvp_status === 'Responded').length,
            late_responses: trackingData.filter(r => r.rsvp_status === 'Late Response').length,
            response_rate: trackingData.length > 0 
                ? ((trackingData.filter(r => r.rsvp_status !== 'Pending').length / trackingData.length) * 100).toFixed(2) + '%'
                : '0%',
            event_attendance: {
                mehndi: {
                    attending: trackingData.filter(r => r.mehndi_attending).length,
                    total_guests: trackingData.reduce((sum, r) => sum + (r.mehndi_attending ? (1 + (r.mehndi_guests || 0)) : 0), 0)
                },
                ceremony: {
                    attending: trackingData.filter(r => r.ceremony_attending).length,
                    total_guests: trackingData.reduce((sum, r) => sum + (r.ceremony_attending ? (1 + (r.ceremony_guests || 0)) : 0), 0)
                },
                reception: {
                    attending: trackingData.filter(r => r.reception_attending).length,
                    total_guests: trackingData.reduce((sum, r) => sum + (r.reception_attending ? (1 + (r.reception_guests || 0)) : 0), 0)
                }
            },
            dietary_restrictions_count: trackingData.filter(r => r.dietary_restrictions && r.dietary_restrictions.trim() !== '').length
        };

        // Group by inviter if no specific filter
        let byInviter = null;
        if (!invitedBy) {
            const inviters = [...new Set(trackingData.map(r => r.invited_by))];
            byInviter = inviters.map(inviter => {
                const guests = trackingData.filter(r => r.invited_by === inviter);
                return {
                    invited_by: inviter,
                    total: guests.length,
                    pending: guests.filter(r => r.rsvp_status === 'Pending').length,
                    responded: guests.filter(r => r.rsvp_status !== 'Pending').length,
                    response_rate: guests.length > 0 
                        ? ((guests.filter(r => r.rsvp_status !== 'Pending').length / guests.length) * 100).toFixed(2) + '%'
                        : '0%'
                };
            });
        }

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Cache-Control': 'no-cache' },
            body: JSON.stringify({
                success: true,
                summary,
                by_inviter: byInviter,
                guests: trackingData,
                filters_applied: {
                    status: status !== 'all' ? status : 'all',
                    invited_by: invitedBy || 'all'
                }
            })
        };

    } catch (error) {
        console.error('Error fetching RSVP tracking:', error);
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


