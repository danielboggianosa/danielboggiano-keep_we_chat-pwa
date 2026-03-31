-- Migration 007: Create edit_records table
-- Requisitos: 6.1, 6.5

CREATE TABLE edit_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID NOT NULL,
    segment_index INTEGER NOT NULL,
    previous_text TEXT NOT NULL,
    new_text TEXT NOT NULL,
    edited_by UUID NOT NULL,
    edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_edit_records_transcription
        FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_edit_records_user
        FOREIGN KEY (edited_by) REFERENCES users(id)
);
