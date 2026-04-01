-- Migration 013: Add Google OAuth support
-- Requisitos: 5.1, 5.2, 5.3

-- 5.1: Agregar columna google_id a users
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;

-- 5.2: Hacer password_hash nullable para usuarios OAuth-only
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 5.3: Agregar google_login al constraint de auth_events
ALTER TABLE auth_events DROP CONSTRAINT chk_auth_events_event_type;
ALTER TABLE auth_events ADD CONSTRAINT chk_auth_events_event_type
    CHECK (event_type IN ('login_success', 'login_failed', 'token_refresh', 'logout', 'google_login'));
