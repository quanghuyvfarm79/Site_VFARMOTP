# Phase 02 - Database & Auth

## Context Links
- Plan: [plan.md](./plan.md)
- Research: [researcher-01-backend-stack.md](./research/researcher-01-backend-stack.md)
- Legacy reference: `rent.otp/app/Services/RentOtpService.php`

## Overview
- **Date**: 2026-03-12
- **Priority**: Critical
- **Status**: pending
- PostgreSQL schema, golang-migrate files, JWT + API Key auth, role middleware

## Key Insights
- Legacy code uses `status_id` integers (7=pending, 8=waiting_otp, 2=success, 3=failed) - use named strings instead for clarity
- API Key stored as plaintext in old code - use `sha256` hash in DB, return raw only once on creation
- GORM selected over sqlc: simpler for this CRUD-heavy app
- `balance` stored as integer (VND cents or whole VND) - use `int64`, avoid float
- `request_id` in legacy can equal `subscriber` (phone) when provider doesn't return one - replicate this fallback

## Requirements
- 6 tables: `users`, `providers`, `transactions`, `balance_logs`, `phone_list`, `user_tokens`
- Migration files (up + down) via golang-migrate
- `POST /auth/register`, `POST /auth/login` endpoints
- JWT middleware for web routes (Bearer token)
- API Key middleware for `/api/?key=` routes
- Role middleware: `admin` vs `user`

## Architecture

### DB Schema
```sql
-- users
CREATE TABLE users (
  id         BIGSERIAL PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,        -- bcrypt
  role       VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  balance    BIGINT NOT NULL DEFAULT 0,    -- VND, integer
  api_key    VARCHAR(64) UNIQUE,           -- sha256 hash stored
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- providers
CREATE TABLE providers (
  id             BIGSERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  url            TEXT NOT NULL,            -- get phone URL
  url_otp        TEXT NOT NULL,            -- get OTP URL (append request_id)
  key_phone      VARCHAR(255),             -- JSON path e.g. "data.phone"
  key_req_id     VARCHAR(255),             -- JSON path e.g. "data.request_id"
  key_otp        VARCHAR(255),             -- JSON path e.g. "data.otp_code"
  fee            BIGINT NOT NULL DEFAULT 0,
  timeout        INT NOT NULL DEFAULT 300, -- seconds
  time_delay     INT NOT NULL DEFAULT 10,  -- poll interval seconds
  use_phone_list BOOLEAN NOT NULL DEFAULT false,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- transactions
CREATE TABLE transactions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  provider_id BIGINT NOT NULL REFERENCES providers(id),
  phone       VARCHAR(20),
  request_id  VARCHAR(255),
  otp         VARCHAR(20),
  status      VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | waiting_phone | waiting_otp | success | failed | cancelled
  amount      BIGINT NOT NULL DEFAULT 0,
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- balance_logs
CREATE TABLE balance_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  type       VARCHAR(20) NOT NULL,  -- 'deduct' | 'refund' | 'topup'
  amount     BIGINT NOT NULL,
  ref_id     BIGINT,               -- transaction id
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- phone_list (for providers using fixed phone pool)
CREATE TABLE phone_list (
  id          BIGSERIAL PRIMARY KEY,
  provider_id BIGINT NOT NULL REFERENCES providers(id),
  phone       VARCHAR(20) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'available',  -- 'available' | 'used'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_tokens (JWT refresh tokens)
CREATE TABLE user_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  token      VARCHAR(512) NOT NULL,
  expired_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration Files
```
migrations/
├── 000001_init_schema.up.sql    # all tables above
├── 000001_init_schema.down.sql  # DROP TABLE IF EXISTS (reverse order)
├── 000002_seed_admin.up.sql     # insert default admin user
└── 000002_seed_admin.down.sql   # DELETE admin
```

### GORM Models (`internal/model/`)
```go
type User struct {
    ID        uint      `gorm:"primaryKey"`
    Email     string    `gorm:"uniqueIndex;not null"`
    Password  string    `gorm:"not null"`
    Role      string    `gorm:"default:user"`
    Balance   int64     `gorm:"default:0"`
    APIKey    string    `gorm:"uniqueIndex"`
    Active    bool      `gorm:"default:true"`
    CreatedAt time.Time
}
```

### Auth Flow
```
Register: POST /auth/register {email, password}
  → hash password (bcrypt cost=12)
  → insert user
  → return 201

Login: POST /auth/login {email, password}
  → verify bcrypt
  → sign JWT (exp: 24h, claims: user_id, role)
  → return {token, user{id,email,role,balance}}

JWT Middleware:
  → extract Bearer token from Authorization header
  → verify signature + expiry
  → set c.Set("user_id", claims.UserID)

APIKey Middleware:
  → extract ?key= query param
  → sha256(key) → lookup in users.api_key
  → set c.Set("user_id", user.ID)

RoleMiddleware("admin"):
  → read c.Get("user_id")
  → check user.role == "admin"
  → 403 if not
```

## Related Code Files
| File | Action |
|------|--------|
| `migrations/000001_init_schema.up.sql` | create |
| `migrations/000001_init_schema.down.sql` | create |
| `migrations/000002_seed_admin.up.sql` | create |
| `internal/model/user.go` | create |
| `internal/model/provider.go` | create |
| `internal/model/transaction.go` | create |
| `internal/model/balance_log.go` | create |
| `internal/repository/user_repo.go` | create |
| `internal/service/auth_service.go` | create |
| `internal/handler/auth_handler.go` | create |
| `internal/middleware/jwt.go` | create |
| `internal/middleware/apikey.go` | create |
| `internal/middleware/role.go` | create |
| `pkg/jwt/jwt.go` | create |
| `cmd/api/main.go` | modify - register auth routes |

## Implementation Steps
1. Write `migrations/000001_init_schema.up.sql` with all 6 tables
2. Write `migrations/000001_init_schema.down.sql` (DROP in reverse order)
3. Write `migrations/000002_seed_admin.up.sql` (insert admin with bcrypt password)
4. Create GORM models in `internal/model/`
5. Write `internal/repository/user_repo.go`: `FindByEmail`, `FindByAPIKey`, `Create`, `UpdateBalance`
6. Write `pkg/jwt/jwt.go`: `Sign(userID, role)`, `Verify(token) Claims`
7. Write `internal/service/auth_service.go`: `Register`, `Login`, `GenerateAPIKey`
8. Write `internal/handler/auth_handler.go`: `Register`, `Login`, `GetAPIKey`
9. Write middleware files (JWT, APIKey, Role)
10. Wire routes in `cmd/api/main.go`:
    - `POST /auth/register` → public
    - `POST /auth/login` → public
    - `GET /auth/apikey` → JWT protected
11. Run `make migrate` to apply schema

## Todo List
- [ ] Write migration 000001 (up + down)
- [ ] Write migration 000002 seed admin (up + down)
- [ ] Create all GORM models
- [ ] Implement user repository
- [ ] Implement JWT sign/verify in `pkg/jwt/`
- [ ] Implement auth service (register, login)
- [ ] Implement auth handler
- [ ] Implement JWT middleware
- [ ] Implement APIKey middleware (sha256 lookup)
- [ ] Implement role middleware
- [ ] Register routes in `cmd/api/main.go`
- [ ] Test: register, login, access protected endpoint

## Success Criteria
- `POST /auth/register` creates user, returns 201
- `POST /auth/login` with valid credentials returns JWT
- `GET /auth/apikey` with valid JWT returns api_key (raw, once)
- Request with invalid JWT returns 401
- Request with invalid API key returns 401
- Non-admin accessing admin route returns 403
- `make migrate` runs without error

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| bcrypt too slow in tests | Use cost=4 in test env |
| API key collision | sha256 of UUID v4 - collision probability negligible |
| balance race condition (concurrent deduct) | Use `UPDATE ... WHERE balance >= amount` in transaction |

## Security Considerations
- Passwords: bcrypt cost=12 minimum
- API keys: never store raw, only sha256 hash; show raw only at creation
- JWT secret: minimum 32 chars, from env, never hardcoded
- Balance updates: always use DB-level atomic operations (not read-modify-write in Go)
- `active=false` users: reject on login and on API key lookup

## Next Steps
Phase 03: OTP Core Engine (provider system + Asynq job chain)
