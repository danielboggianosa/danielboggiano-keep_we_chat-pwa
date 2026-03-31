-- Migration 005: Create action_items table
-- Requisitos: 6.1, 6.5

CREATE TABLE action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID NOT NULL,
    assigned_to_speaker_id UUID,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reminder_calendar_id VARCHAR(255),

    CONSTRAINT fk_action_items_transcription
        FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_action_items_speaker
        FOREIGN KEY (assigned_to_speaker_id) REFERENCES speakers(id) ON DELETE SET NULL,
    CONSTRAINT chk_action_items_status
        CHECK (status IN ('pending', 'completed'))
);
