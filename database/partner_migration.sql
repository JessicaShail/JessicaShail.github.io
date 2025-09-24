-- Partner RSVP Feature Migration Script
-- Run this in your Neon database console to add partner support

-- Add partner columns to guest_list table
ALTER TABLE guest_list 
ADD COLUMN IF NOT EXISTS partner_name VARCHAR(255);

-- Add partner columns to rsvps table
ALTER TABLE rsvps 
ADD COLUMN IF NOT EXISTS partner_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS partner_mehndi_attending BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS partner_ceremony_attending BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS partner_reception_attending BOOLEAN DEFAULT FALSE;

-- Drop existing view first to avoid column name conflicts
DROP VIEW IF EXISTS rsvp_summary;

-- Create the rsvp_summary view with partner statistics
CREATE VIEW rsvp_summary AS
SELECT 
    COUNT(*) as total_rsvps,
    SUM(CASE WHEN mehndi_attending THEN 1 ELSE 0 END) as mehndi_primary_attendees,
    SUM(CASE WHEN ceremony_attending THEN 1 ELSE 0 END) as ceremony_primary_attendees,
    SUM(CASE WHEN reception_attending THEN 1 ELSE 0 END) as reception_primary_attendees,
    SUM(CASE WHEN partner_mehndi_attending THEN 1 ELSE 0 END) as mehndi_partner_attendees,
    SUM(CASE WHEN partner_ceremony_attending THEN 1 ELSE 0 END) as ceremony_partner_attendees,
    SUM(CASE WHEN partner_reception_attending THEN 1 ELSE 0 END) as reception_partner_attendees,
    SUM(CASE WHEN mehndi_attending THEN 1 ELSE 0 END) + SUM(CASE WHEN partner_mehndi_attending THEN 1 ELSE 0 END) as total_mehndi_attendees,
    SUM(CASE WHEN ceremony_attending THEN 1 ELSE 0 END) + SUM(CASE WHEN partner_ceremony_attending THEN 1 ELSE 0 END) as total_ceremony_attendees,
    SUM(CASE WHEN reception_attending THEN 1 ELSE 0 END) + SUM(CASE WHEN partner_reception_attending THEN 1 ELSE 0 END) as total_reception_attendees,
    SUM(mehndi_guests) as total_mehndi_guests,
    SUM(ceremony_guests) as total_ceremony_guests,
    SUM(reception_guests) as total_reception_guests
FROM rsvps;

-- Sample data updates (adjust as needed for your guest list)
-- Example: UPDATE guest_list SET partner_name = 'Partner Name' WHERE guest_name = 'Guest Name';

COMMIT;
