# Go Web Application Stack Research Report
**VframeOTP Backend Architecture**
**Research Date**: 2026-03-12

---

## 1. Project Structure (cmd/internal/pkg Pattern)

### Recommended Layout
```
project/
├── cmd/
│   ├── api/main.go           # HTTP API entry point
│   └── worker/main.go         # Asynq worker entry point
├── internal/
│   ├── auth/                  # JWT + API Key auth
│   ├── otp/                   # OTP business logic (GetPhone, PollOTP, Refund)
│   ├── queue/                 # Asynq task definitions
│   ├── db/                    # Database models & migrations
│   ├── middleware/            # HTTP middleware (CORS, JWT, logging)
│   └── config/                # Configuration management
├── pkg/                       # Only if planning public library exports
├── migrations/                # SQL migrations (golang-migrate)
├── Makefile
└── go.mod
```

### Best Practices (2025)
- **Feature-based organization**: `internal/otp/` contains handlers, services, repositories for that domain
- **Avoid excessive nesting**: Keep paths shallow (max 3 levels)
- **Package naming**: lowercase, short, singular (not `users`, use `user`)
- **Internal enforcement**: Go compiler prevents external imports of `internal/` packages

---

## 2. Gin Framework: Middleware & Error Handling

### Middleware Setup
```go
// cmd/api/main.go
func setupRouter() *gin.Engine {
    router := gin.Default()

    // Global middleware
    router.Use(middleware.LoggingMiddleware())
    router.Use(middleware.RecoveryMiddleware())

    // CORS middleware (gin-contrib/cors)
    router.Use(cors.Default())

    // Auth groups
    public := router.Group("/api")
    protected := router.Group("/api")
    protected.Use(middleware.JWTAuth(), middleware.APIKeyAuth())

    // Route grouping by feature
    registerOTPRoutes(public, protected)

    return router
}
```

### Error Handling Pattern
- Use custom recovery middleware that logs stack traces without exposing internals
- Return generic error responses in production (`{"error": "internal server error"}`)
- Implement centralized error types for domain logic
- Middleware processes panics; handlers return explicit errors via `c.JSON(status, error)`

### CORS + OPTIONS Handling
- gin-contrib/cors handles preflight OPTIONS automatically
- Configure allowed origins, methods, and credentials

---

## 3. Asynq Task Queue Architecture

### Job Chain Pattern
```go
// tasks/jobs.go
const (
    TypeGetPhone    = "otp:get_phone"    // Step 1
    TypePollOTP     = "otp:poll_otp"     // Step 2
    TypeRefund      = "otp:refund"       // Step 3 on failure
)

// Enqueue workflow in handler
func InitiateOTP(c *gin.Context) {
    // Start chain with retry/timeout
    task1 := asynq.NewTask(TypeGetPhone,
        payload,
        asynq.MaxRetry(3),
        asynq.Timeout(5 * time.Minute),
    )
    client.Enqueue(task1)
    // Subsequent tasks enqueued from handlers after success
}

// Handler pattern
func HandlePollOTP(ctx context.Context, t *asynq.Task) error {
    // On success: enqueue next task
    // On failure: enqueue refund task
    return nil
}
```

### Configuration
- Default: MaxRetry=25, Timeout=30min (override per task)
- Task uniqueness: Use `asynq.Unique()` to prevent duplicates
- Grouping: Tasks in same queue + group auto-aggregate
- Dead letter handling: Failed tasks after retries go to dead letter queue

### Trade-off
Asynq lacks workflow primitives (chains, chords) out of box—implement manually by enqueueing next task on success. For complex workflows, consider Temporal.io (but overkill for 3-step OTP flow).

---

## 4. golang-migrate Migration Patterns

### File Naming & Structure
```
migrations/
├── 000001_init_schema.up.sql
├── 000001_init_schema.down.sql
├── 000002_add_users_table.up.sql
├── 000002_add_users_table.down.sql
```

### Best Practices
- **Sequential numbering**: 000001, 000002, etc. (prevents conflicts)
- **Idempotent down**: Use `DROP TABLE IF EXISTS`
- **Transactions**: All SQL wrapped in single transaction per migration
- **Version control**: Always commit .up and .down files
- **Testing**: Test down migrations in staging

### Integration with Go
```go
import "github.com/golang-migrate/migrate/v4"

func RunMigrations(dbURL string) error {
    m, _ := migrate.New("file://migrations", dbURL)
    return m.Up()
}
```

---

## 5. GORM vs sqlc: Decision for OTP Site

### Recommendation: **GORM** (for your use case)
**Why**: Small OTP site with simple CRUD (users, transactions, OTP records). GORM's simplicity wins.

| Criteria | GORM | sqlc |
|----------|------|------|
| Learning curve | Low | Medium (need SQL knowledge) |
| CRUD ops | Excellent | Good |
| Complex queries | Medium | Excellent |
| Type safety | Good | Best |
| Performance | ~20-30% slower | ~30% faster |
| Overhead for small app | Acceptable | Unnecessary |

### GORM Quick Setup
```go
// internal/db/models.go
type User struct {
    ID        uint
    Email     string
    OTPs      []OTP `gorm:"foreignKey:UserID"`
}

type OTP struct {
    ID        uint
    UserID    uint
    Code      string
    ExpiresAt time.Time
}

// internal/db/repo.go
func (r *UserRepo) CreateOTP(ctx context.Context, otp *OTP) error {
    return r.db.WithContext(ctx).Create(otp).Error
}
```

### When sqlc Wins
- Complex analytics queries (window functions, CTEs)
- Extreme performance requirements (100k+ qps)
- Your team is SQL-expert focused

**Decision**: Stick with GORM + migrate for rapid development.

---

## 6. Dual Auth: JWT + API Key Pattern

### Implementation Strategy
```go
// internal/auth/middleware.go
type Claims struct {
    UserID   int
    Email    string
    Source   string // "jwt" or "apikey"
    jwt.StandardClaims
}

func JWTAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractToken(c)
        if token != "" {
            claims, err := verifyJWT(token)
            if err == nil {
                c.Set("user", claims)
                c.Next()
                return
            }
        }
        c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
    }
}

func APIKeyAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        apiKey := c.GetHeader("X-API-Key")
        if apiKey != "" {
            user, err := verifyAPIKey(apiKey)
            if err == nil {
                c.Set("user", user)
                c.Next()
                return
            }
        }
        c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
    }
}

// Usage
protected := router.Group("/api")
protected.Use(middleware.JWTAuth(), middleware.APIKeyAuth()) // Try both
```

### Token Strategy
- **Access tokens**: Short-lived (15 min), stored in HttpOnly cookie
- **Refresh tokens**: Long-lived (7 days), stored in HttpOnly cookie
- **API keys**: Stored in DB, tied to service accounts or integrations
- **Verification**: Use `golang-jwt/jwt/v4` (modern standard)

---

## Summary Table

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Project layout | cmd/internal | Go standard, enforced by compiler |
| Web framework | Gin | Lightweight, fast middleware pipeline |
| Database | PostgreSQL + GORM | Simple schema, zero-friction GORM |
| Migrations | golang-migrate | Lightweight, reproducible, battle-tested |
| Task queue | Asynq + Redis | Simple OTP workflow, built-in retries/deadletter |
| Auth | JWT (user) + API Key (service) | Stateless, flexible, industry standard |

---

## Unresolved Questions

1. How to handle Asynq task result passing between GetPhone → PollOTP → Refund (callback pattern or shared state)?
2. Should API Key be hashed in DB or plaintext? (Recommend hashed + salt)
3. Rate limiting strategy: Built into Gin middleware or Redis-based?
4. Database connection pooling: GORM defaults sufficient or tune pool size for concurrency?

---

## Sources

- [golang-standards/project-layout](https://github.com/golang-standards/project-layout)
- [Go Project Structure: Practices & Patterns](https://www.glukhov.org/post/2025/12/go-project-structure/)
- [Gin Documentation](https://gin-gonic.com/en/docs/)
- [gin-contrib/cors](https://github.com/gin-contrib/cors)
- [appleboy/gin-jwt](https://github.com/appleboy/gin-jwt)
- [hibiken/asynq](https://github.com/hibiken/asynq)
- [Asynq Documentation](https://pkg.go.dev/github.com/hibiken/asynq)
- [Comparing the best Go ORMs (2026)](https://encore.cloud/resources/go-orms)
- [ORM to use in GO: GORM, sqlc, Ent or Bun?](https://www.glukhov.org/post/2025/03/which-orm-to-use-in-go/)
- [SQLC vs GORM - Two Approaches to Database Interaction](https://leapcell.io/blog/sqlc-vs-gorm-two-approaches-to-database-interaction-in-go)
- [JWT Authentication in Go with Gin](https://developer.vonage.com/en/blog/using-jwt-for-authentication-in-a-golang-application-dr)
- [golang-jwt/jwt](https://github.com/golang-jwt/jwt)
- [Implementing JWT based authentication in Golang](https://www.sohamkamani.com/golang/jwt-authentication/)
