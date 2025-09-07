-- Wedding RSVP Database Schema for Neon PostgreSQL
-- Run this script in your Neon database console

-- Create the main RSVP table
CREATE TABLE IF NOT EXISTS rsvps (
    id SERIAL PRIMARY KEY,
    guest_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    
    -- Event attendance
    mehndi_attending BOOLEAN DEFAULT FALSE,
    mehndi_guests INTEGER DEFAULT 0,
    
    ceremony_attending BOOLEAN DEFAULT FALSE,
    ceremony_guests INTEGER DEFAULT 0,
    
    reception_attending BOOLEAN DEFAULT FALSE,
    reception_guests INTEGER DEFAULT 0,
    
    -- Additional information
    dietary_restrictions TEXT,
    special_message TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Create guest list table for validation
CREATE TABLE IF NOT EXISTS guest_list (
    id SERIAL PRIMARY KEY,
    guest_name VARCHAR(255) NOT NULL UNIQUE,
    invited_by VARCHAR(255),
    max_guests INTEGER DEFAULT 2,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rsvps_email ON rsvps(email);
CREATE INDEX IF NOT EXISTS idx_rsvps_created_at ON rsvps(created_at);
CREATE INDEX IF NOT EXISTS idx_guest_list_name ON guest_list(guest_name);

-- Create a view for RSVP analytics
CREATE OR REPLACE VIEW rsvp_summary AS
SELECT 
    COUNT(*) as total_rsvps,
    SUM(CASE WHEN mehndi_attending THEN 1 ELSE 0 END) as mehndi_attendees,
    SUM(CASE WHEN ceremony_attending THEN 1 ELSE 0 END) as ceremony_attendees,
    SUM(CASE WHEN reception_attending THEN 1 ELSE 0 END) as reception_attendees,
    SUM(mehndi_guests) as total_mehndi_guests,
    SUM(ceremony_guests) as total_ceremony_guests,
    SUM(reception_guests) as total_reception_guests
FROM rsvps;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_rsvps_updated_at 
    BEFORE UPDATE ON rsvps 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
