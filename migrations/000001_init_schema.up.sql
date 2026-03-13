CREATE TABLE users (
    id         BIGSERIAL PRIMARY KEY,
    email      VARCHAR(255) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(20)  NOT NULL DEFAULT 'user',
    balance    BIGINT       NOT NULL DEFAULT 0,
    api_key    VARCHAR(64)  UNIQUE,
    active     BOOLEAN      NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE providers (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    url            TEXT         NOT NULL,
    url_otp        TEXT         NOT NULL,
    key_phone      VARCHAR(255),
    key_req_id     VARCHAR(255),
    key_otp        VARCHAR(255),
    fee            BIGINT       NOT NULL DEFAULT 0,
    timeout        INT          NOT NULL DEFAULT 300,
    time_delay     INT          NOT NULL DEFAULT 10,
    use_phone_list BOOLEAN      NOT NULL DEFAULT false,
    active         BOOLEAN      NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id),
    provider_id BIGINT       NOT NULL REFERENCES providers(id),
    phone       VARCHAR(20),
    request_id  VARCHAR(255),
    otp         VARCHAR(20),
    status      VARCHAR(30)  NOT NULL DEFAULT 'pending',
    amount      BIGINT       NOT NULL DEFAULT 0,
    message     TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE balance_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id),
    type       VARCHAR(20) NOT NULL,
    amount     BIGINT      NOT NULL,
    ref_id     BIGINT,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE phone_list (
    id          BIGSERIAL PRIMARY KEY,
    provider_id BIGINT      NOT NULL REFERENCES providers(id),
    phone       VARCHAR(20) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'available',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id),
    token      VARCHAR(512) NOT NULL,
    expired_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_request_id ON transactions(request_id);
CREATE INDEX idx_balance_logs_user_id ON balance_logs(user_id);
CREATE INDEX idx_phone_list_provider_status ON phone_list(provider_id, status);
