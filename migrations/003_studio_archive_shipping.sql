ALTER TABLE spotlight.assets ADD COLUMN deleted_at timestamptz;
ALTER TABLE spotlight.assets ADD CONSTRAINT original_not_archived CHECK (kind <> 'original' OR deleted_at IS NULL);
ALTER TABLE spotlight.assets ADD CONSTRAINT archive_not_published CHECK (deleted_at IS NULL OR (NOT selected AND public_url IS NULL));
ALTER TABLE spotlight.orders ADD COLUMN shipping jsonb NOT NULL DEFAULT '{}';
