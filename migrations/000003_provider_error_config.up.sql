-- Add error detection config to providers
-- key_error_code: JSON path to check for error code e.g. "Error_Code"
-- error_code_fatal: value that means "phone permanently unavailable" e.g. "6"
ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS key_error_code VARCHAR(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS error_code_fatal VARCHAR(255) DEFAULT '';

-- Add 'bad' status to phone_list for permanently failed phones
-- bad = provider returned fatal error for this phone (admin should remove it)
COMMENT ON COLUMN phone_list.status IS 'available | used | bad';
