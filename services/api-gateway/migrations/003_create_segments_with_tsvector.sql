-- Migration 003: Create segments table with tsvector for full-text search
-- Requisitos: 6.1, 6.4, 6.5

CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID NOT NULL,
    speaker_id UUID,
    start_time FLOAT NOT NULL,
    end_time FLOAT NOT NULL,
    content TEXT NOT NULL,
    confidence FLOAT NOT NULL,
    order_index INTEGER NOT NULL,
    search_vector TSVECTOR,

    CONSTRAINT chk_segments_times
        CHECK (start_time >= 0 AND end_time > start_time),
    CONSTRAINT chk_segments_confidence
        CHECK (confidence >= 0 AND confidence <= 1)
);

-- Note: Foreign keys for transcription_id and speaker_id are added
-- after the speakers table is created (see 004 and 012).
