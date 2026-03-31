-- Migration 011: Create auth_events table
-- Requisitos: 6.1, 6.5

CREATE TABLE auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    event_type VARCHAR(30) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_auth_events_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_auth_events_event_type
        CHECK (event_type IN ('login_success', 'login_failed', 'token_refresh', 'logout'))
);
