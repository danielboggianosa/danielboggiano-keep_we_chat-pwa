-- Migration 008: Create transcription_shares table
-- Requisitos: 6.1, 6.5

CREATE TABLE transcription_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID NOT NULL,
    shared_by_user_id UUID NOT NULL,
    shared_with_user_id UUID NOT NULL,
    permission VARCHAR(20) NOT NULL DEFAULT 'read',
    shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_shares_transcription
        FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_shares_shared_by
        FOREIGN KEY (shared_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_shares_shared_with
        FOREIGN KEY (shared_with_user_id) REFERENCES users(id),
    CONSTRAINT chk_shares_permission
        CHECK (permission IN ('read', 'read-write')),
    CONSTRAINT uq_shares_unique
        UNIQUE (transcription_id, shared_with_user_id)
);
