-- Migration 004: Create speakers table
-- Requisitos: 6.1, 6.5

CREATE TABLE speakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID NOT NULL,
    label VARCHAR(255) NOT NULL,
    identified_name VARCHAR(255),

    CONSTRAINT fk_speakers_transcription
        FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE
);

-- Now that speakers exists, add foreign keys to segments
ALTER TABLE segments
    ADD CONSTRAINT fk_segments_transcription
        FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE;

ALTER TABLE segments
    ADD CONSTRAINT fk_segments_speaker
        FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE SET NULL;
