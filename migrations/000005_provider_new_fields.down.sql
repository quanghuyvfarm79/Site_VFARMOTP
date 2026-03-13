ALTER TABLE providers
    DROP COLUMN IF EXISTS key_otp_done,
    DROP COLUMN IF EXISTS allow_renew,
    DROP COLUMN IF EXISTS auto_reset_used;
