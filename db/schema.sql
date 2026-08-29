-- ==============================================================================
-- Con Edison Floor 07 MusterCommand Life-Safety Database Schema
-- Production PostgreSQL 14+ Schema with Cryptographic Ledger Integrity
-- ==============================================================================

-- 1. Occupants & Floor 07 Census Table
CREATE TABLE IF NOT EXISTS occupants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(64),
    role VARCHAR(64) NOT NULL DEFAULT 'Employee',
    company VARCHAR(255) NOT NULL DEFAULT 'Con Edison',
    quadrant VARCHAR(16) NOT NULL,
    desk VARCHAR(64),
    status VARCHAR(64) NOT NULL DEFAULT 'safe',
    location_category VARCHAR(64) NOT NULL DEFAULT 'inside-building',
    assembly_point VARCHAR(128),
    checked_in BOOLEAN NOT NULL DEFAULT true,
    last_check_in_time VARCHAR(64),
    last_check_in_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_offline_created BOOLEAN DEFAULT false,
    badged_out BOOLEAN DEFAULT false,
    off_site_today BOOLEAN DEFAULT false,
    x_coord NUMERIC(5, 2) DEFAULT 50.0,
    y_coord NUMERIC(5, 2) DEFAULT 50.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_occupants_quadrant ON occupants (quadrant);
CREATE INDEX IF NOT EXISTS idx_occupants_status ON occupants (status);
CREATE INDEX IF NOT EXISTS idx_occupants_phone ON occupants (phone);
CREATE INDEX IF NOT EXISTS idx_occupants_location_category ON occupants (location_category);

-- 2. Attendance & Ingress Scan Event Log
CREATE TABLE IF NOT EXISTS attendance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occupant_id VARCHAR(64) REFERENCES occupants(id) ON DELETE CASCADE,
    occupant_name VARCHAR(255),
    action VARCHAR(32) NOT NULL DEFAULT 'enter',
    status VARCHAR(64) NOT NULL DEFAULT 'safe',
    via VARCHAR(64) DEFAULT 'qr-entrance-scanner',
    notes TEXT,
    location_category VARCHAR(64) DEFAULT 'inside-building',
    assembly_point VARCHAR(128),
    signature_data TEXT,
    signature_type VARCHAR(32),
    is_offline_replay BOOLEAN DEFAULT false,
    client_timestamp TIMESTAMPTZ,
    server_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_occupant_id ON attendance_events (occupant_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON attendance_events (server_timestamp);

-- 3. Cryptographic SHA-256 Audit Ledger Chain
CREATE TABLE IF NOT EXISTS audit_ledger (
    block_index BIGINT PRIMARY KEY,
    prev_hash VARCHAR(128) NOT NULL,
    hash VARCHAR(128) NOT NULL UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL,
    action VARCHAR(128) NOT NULL,
    operator VARCHAR(255) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_sealed BOOLEAN DEFAULT false,
    sealed_at TIMESTAMPTZ,
    sealed_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_hash ON audit_ledger (hash);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_ledger (action);

-- 4. Emergency Incident & Evacuation Log
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(64) PRIMARY KEY,
    mode VARCHAR(64) NOT NULL DEFAULT 'drill',
    active BOOLEAN NOT NULL DEFAULT true,
    declared_by VARCHAR(255) NOT NULL,
    notes TEXT,
    declared_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(255),
    final_census JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents (active);

-- 5. Multi-Channel Broadcast History
CREATE TABLE IF NOT EXISTS broadcast_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(64) REFERENCES incidents(id) ON DELETE SET NULL,
    channels TEXT[] NOT NULL DEFAULT ARRAY['SMS', 'VOICE', 'IN_APP', 'PA'],
    target_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    message_text TEXT NOT NULL,
    initiated_by VARCHAR(255) NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
