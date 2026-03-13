ALTER TABLE phone_list ADD CONSTRAINT uq_phone_list_provider_phone UNIQUE (provider_id, phone);
