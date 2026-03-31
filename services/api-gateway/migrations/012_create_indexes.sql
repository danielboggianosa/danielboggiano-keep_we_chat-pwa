-- Migration 012: Create all indexes and search_vector trigger
-- Requisitos: 6.4, 6.5

-- Indexes for frequent lookups on foreign keys
CREATE INDEX idx_transcriptions_owner_id ON transcriptions(owner_id);
CREATE INDEX idx_transcriptions_recorded_at ON transcriptions(recorded_at);
CREATE INDEX idx_segments_transcription_id ON segments(transcription_id);
CREATE INDEX idx_segments_speaker_id ON segments(speaker_id);

-- Full-text search GIN index on tsvector
CREATE INDEX idx_segments_search_vector ON segments USING GIN(search_vector);

-- Trigger function to auto-update search_vector based on transcription language
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector(
        CASE
            WHEN (SELECT language FROM transcriptions WHERE id = NEW.transcription_id) = 'es'
            THEN 'spanish'
            ELSE 'english'
        END,
        COALESCE(NEW.content, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_segments_search_vector
    BEFORE INSERT OR UPDATE OF content ON segments
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Other indexes for frequent queries
CREATE INDEX idx_edit_records_transcription_id ON edit_records(transcription_id);
CREATE INDEX idx_shares_transcription_id ON transcription_shares(transcription_id);
CREATE INDEX idx_shares_shared_with ON transcription_shares(shared_with_user_id);
CREATE INDEX idx_action_items_transcription_id ON action_items(transcription_id);
CREATE INDEX idx_calendar_tokens_user_provider ON calendar_tokens(user_id, provider);
CREATE INDEX idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
