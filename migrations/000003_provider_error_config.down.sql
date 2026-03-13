ALTER TABLE providers
    DROP COLUMN IF EXISTS key_error_code,
    DROP COLUMN IF EXISTS error_code_fatal;
