-- Default admin: email=admin@vframotp.com password=Admin@123
-- Hash generated with bcrypt cost=12
INSERT INTO users (email, password, role, balance, active)
VALUES (
    'admin@vframotp.com',
    '$2a$12$HXc6iq1hcXz41OglHtkH6esw7a7wzY/1oyWXloKs6AXZke9FHaEkO',
    'admin',
    0,
    true
)
ON CONFLICT (email) DO NOTHING;
