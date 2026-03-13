# Phase 03 - OTP Core Engine

## Context Links
- Plan: [plan.md](./plan.md)
- Research: [researcher-01-backend-stack.md](./research/researcher-01-backend-stack.md)
- Legacy: `rent.otp/app/Services/RentOtpService.php` (process() method = poll logic)

## Overview
- **Date**: 2026-03-12
- **Priority**: Critical
- **Status**: pending
- Config-driven provider system + Asynq 3-job chain + transaction state machine + balance refund

## Key Insights
- Legacy PHP uses `preg_match("/(\d{4,8})/", $strOtpOriginal)` - replicate exact regex in Go
- Legacy fallback: if provider returns no `request_id`, use `phone` as `request_id` (replicate this)
- Old code increments `time` field per poll - Go: use `created_at + timeout` comparison instead (cleaner)
- `use_phone_list=true` providers: pick first `available` phone from `phone_list`, append to URL
- `SSL verify off` - use `http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}`
- Asynq chains: manually enqueue next task on success (no built-in chain primitive)
- Balance deduct BEFORE job dispatch; refund via RefundJob on any failure

## Requirements
- `pkg/provider/client.go`: generic HTTP GET + JSON path parser (dot-notation)
- `internal/queue/`: task type constants + payload structs
- 3 Asynq handlers: `GetPhoneHandler`, `PollOTPHandler`, `RefundHandler`
- Status transitions: `pending` → `waiting_phone` → `waiting_otp` → `success`/`failed`
- Atomic balance deduct using SQL `WHERE balance >= amount`
- Phone list: mark phone `used` after assignment, release on refund

## Architecture

### Provider Client (`pkg/provider/client.go`)
```go
// HTTP GET with SSL skip + JSON path extraction
type Client struct {
    http *http.Client  // InsecureSkipVerify=true
}

// GetJSON: GET url, return raw JSON map
func (c *Client) GetJSON(url string) (map[string]interface{}, error)

// ExtractPath: "data.phone" → walk JSON map
func ExtractPath(data map[string]interface{}, path string) string
```

### Task Definitions (`internal/queue/tasks.go`)
```go
const (
    TypeGetPhone = "otp:get_phone"
    TypePollOTP  = "otp:poll_otp"
    TypeRefund   = "otp:refund"
)

type GetPhonePayload struct {
    TransactionID uint `json:"transaction_id"`
}
type PollOTPPayload struct {
    TransactionID uint `json:"transaction_id"`
    Attempt       int  `json:"attempt"`
}
type RefundPayload struct {
    TransactionID uint   `json:"transaction_id"`
    Reason        string `json:"reason"`
}
```

### Job Chain Flow
```
[POST /api/get_number]
  → DeductBalance (SQL atomic)
  → CreateTransaction (status=pending)
  → Enqueue(TypeGetPhone, payload)
  → Return 200 {transaction_id}

[GetPhoneHandler]
  → Load transaction + provider
  → If use_phone_list: pick available phone, mark used
  → GET provider.url (+ phone if list mode)
  → ExtractPath(response, provider.key_phone) → phone
  → ExtractPath(response, provider.key_req_id) → request_id
  → If request_id empty: request_id = phone (legacy fallback)
  → Update transaction: phone, request_id, status=waiting_otp
  → Enqueue(TypePollOTP, {transaction_id, attempt:0})

[PollOTPHandler]
  → Load transaction + provider
  → Check: created_at + timeout < now → Enqueue(Refund, "timeout"), return nil
  → GET provider.url_otp + request_id
  → ExtractPath(response, provider.key_otp) → otp_raw
  → regex match \d{4,8} → otp
  → If otp found: Update status=success, otp=otp → return nil
  → Else: Enqueue(TypePollOTP, {attempt+1}, ProcessIn: time_delay seconds)

[RefundHandler]
  → Load transaction
  → If status already success/failed: skip (idempotent)
  → UPDATE transaction status=failed, message=reason
  → UPDATE users SET balance = balance + amount WHERE id = user_id
  → INSERT balance_logs (type=refund, amount, ref_id=transaction_id)
  → If use_phone_list: UPDATE phone_list SET status=available WHERE phone=transaction.phone
```

### Asynq Worker Setup (`cmd/worker/main.go`)
```go
srv := asynq.NewServer(
    asynq.RedisClientOpt{Addr: cfg.RedisAddr},
    asynq.Config{
        Concurrency: cfg.WorkerConcurrency,
        Queues: map[string]int{
            "critical": 6,
            "default":  3,
            "low":      1,
        },
    },
)
mux := asynq.NewServeMux()
mux.HandleFunc(queue.TypeGetPhone, handlers.HandleGetPhone)
mux.HandleFunc(queue.TypePollOTP,  handlers.HandlePollOTP)
mux.HandleFunc(queue.TypeRefund,   handlers.HandleRefund)
srv.Run(mux)
```

## Related Code Files
| File | Action |
|------|--------|
| `pkg/provider/client.go` | create |
| `internal/queue/tasks.go` | create |
| `internal/queue/handlers/get_phone.go` | create |
| `internal/queue/handlers/poll_otp.go` | create |
| `internal/queue/handlers/refund.go` | create |
| `internal/service/otp_service.go` | create |
| `internal/repository/transaction_repo.go` | create |
| `internal/repository/provider_repo.go` | create |
| `internal/repository/phone_list_repo.go` | create |
| `cmd/worker/main.go` | modify - register handlers |

## Implementation Steps
1. Write `pkg/provider/client.go`: HTTP client with `InsecureSkipVerify=true`, `GetJSON()`, `ExtractPath()`
2. Write `internal/queue/tasks.go`: constants + payload structs
3. Write `internal/repository/transaction_repo.go`: `Create`, `FindByID`, `UpdateStatus`, `SetOTP`
4. Write `internal/repository/provider_repo.go`: `FindByID`, `ListActive`
5. Write `internal/repository/phone_list_repo.go`: `ClaimPhone` (atomic), `ReleasePhone`
6. Write `internal/service/otp_service.go`: `InitiateOTP` (deduct + create tx + enqueue)
7. Write `internal/queue/handlers/get_phone.go`
8. Write `internal/queue/handlers/poll_otp.go` (regex: `regexp.MustCompile(`\d{4,8}`)`)
9. Write `internal/queue/handlers/refund.go` (idempotent)
10. Wire handlers in `cmd/worker/main.go`
11. Add Asynq inspector dashboard server on `:8081` in worker

## Todo List
- [ ] Implement provider HTTP client with SSL skip
- [ ] Implement JSON path extractor (dot-notation walk)
- [ ] Define task type constants + payload structs
- [ ] Implement transaction repository
- [ ] Implement provider repository
- [ ] Implement phone list repository (atomic claim)
- [ ] Implement `InitiateOTP` service (deduct balance atomically)
- [ ] Implement `GetPhoneHandler`
- [ ] Implement `PollOTPHandler` with timeout check + regex OTP extract
- [ ] Implement `RefundHandler` (idempotent)
- [ ] Wire all handlers in `cmd/worker/main.go`
- [ ] Test full flow: initiate → get phone → poll → success
- [ ] Test timeout path → refund fires

## Success Criteria
- Full OTP flow completes: balance deducted → phone assigned → OTP returned → status=success
- Timeout triggers refund: balance restored, status=failed
- `phone_list` phone released on refund
- Balance never goes negative (SQL WHERE guard)
- Asynq dashboard at :8081 shows jobs

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Provider returns unexpected JSON shape | ExtractPath returns empty string → treat as no result |
| PollOTP infinite loop | Always check created_at+timeout; Asynq MaxRetry as safety net |
| Balance double-deduct on retry | Check transaction status at start of GetPhoneHandler |
| Phone list exhausted | Return error to user immediately, refund |

## Security Considerations
- `InsecureSkipVerify=true`: acceptable per brainstorm decision (VN providers have bad certs)
- Provider URLs stored in DB (admin-only write) - no user can inject URLs
- Refund handler must verify transaction belongs to correct user before crediting balance

## Next Steps
Phase 04: Public API endpoints (get_all_services, get_number, get_code, renew)
