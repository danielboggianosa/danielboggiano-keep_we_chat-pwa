-- Migration 006: Create meeting_summaries and formal_minutes tables
-- Requisitos: 6.1, 6.5

CREATE TABLE meeting_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID NOT NULL UNIQUE,
    topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    language VARCHAR(5) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_meeting_summaries_transcription
        FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE,
    CONSTRAINT chk_meeting_summaries_language
        CHECK (language IN ('es', 'en'))
);

CREATE TABLE formal_minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID NOT NULL UNIQUE,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    language VARCHAR(5) NOT NULL,
    finalized BOOLEAN NOT NULL DEFAULT false,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_formal_minutes_transcription
        FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE,
    CONSTRAINT chk_formal_minutes_language
        CHECK (language IN ('es', 'en'))
);
