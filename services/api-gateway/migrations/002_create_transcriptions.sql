-- Migration 002: Create transcriptions table
-- Requisitos: 6.1, 6.5

CREATE TABLE transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    language VARCHAR(5) NOT NULL,
    audio_file_url VARCHAR(1024),
    status VARCHAR(20) NOT NULL DEFAULT 'local',
    duration FLOAT,
    recorded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_transcriptions_owner
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_transcriptions_language
        CHECK (language IN ('es', 'en')),
    CONSTRAINT chk_transcriptions_status
        CHECK (status IN ('local', 'syncing', 'synced', 'enhanced'))
);
