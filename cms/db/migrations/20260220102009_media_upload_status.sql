-- migrate:up

CREATE TYPE media_status AS ENUM ('uploading', 'processing', 'ready', 'failed');

ALTER TABLE media
    ADD COLUMN status media_status NOT NULL DEFAULT 'ready',
    ADD COLUMN upload_key TEXT,
    ALTER COLUMN urls DROP NOT NULL,
    ALTER COLUMN urls SET DEFAULT NULL;

-- Index for finding media that needs processing
CREATE INDEX idx_media_status ON media (status) WHERE status != 'ready';

COMMENT ON COLUMN media.status IS 'Upload/processing status: uploading, processing, ready, failed';
COMMENT ON COLUMN media.upload_key IS 'S3 key for the original uploaded file before processing';

-- migrate:down

DROP INDEX IF EXISTS idx_media_status;

ALTER TABLE media
    DROP COLUMN IF EXISTS upload_key,
    DROP COLUMN IF EXISTS status,
    ALTER COLUMN urls SET NOT NULL,
    ALTER COLUMN urls DROP DEFAULT;

DROP TYPE IF EXISTS media_status;
