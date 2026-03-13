# Phase 04 - Public API

## Context Links
- Plan: [plan.md](./plan.md)
- Brainstorm: `VFRAMOTP/brainstorm-summary.md` (section 5 - API design)
- Legacy: `rent.otp/app/Services/RentOtpService.php` (`requestPhone`, `getOtp`, `getService`)

## Overview
- **Date**: 2026-03-12
- **Priority**: High
- **Status**: pending
- Query-param style public API compatible with otptextnow.com format

## Key Insights
- All 4 actions use single route `GET /api/` with `?key=&action=` params - match exactly
- Legacy `getOtp` checks `status_id==2` for success, `message contains "Timeout"` for timeout - use status field cleanly
- `get_code` returns `"is_comming"` while OTP pending (legacy spelling - keep for compatibility if clients exist, else use `"waiting"`)
- `renew` in legacy = cancel current + get new number (not implemented in PHP - implement as: mark failed + refund + re-initiate)
- API Key validation: sha256(key) → lookup users.api_key

## Requirements
- Single route: `GET /api/` protected by APIKey middleware
- 4 actions dispatched by `action` query param
- `get_number`: synchronous - immediately calls `InitiateOTP` + `GetPhone` (sync, not async for API)
- `get_code`: poll DB (no waiting - just return current status)
- `renew`: cancel + refund + new `get_number`
- Response format matches otptextnow.com spec

## Architecture

### Route
```
GET /api/?key={api_key}&action={action}&id={id}
```
APIKey middleware → dispatch to action handler

### Handler: `internal/handler/public_api_handler.go`
```go
func (h *PublicAPIHandler) Handle(c *gin.Context) {
    action := c.Query("action")
    switch action {
    case "get_all_services": h.getServices(c)
    case "get_number":       h.getNumber(c)
    case "get_code":         h.getCode(c)
    case "renew":            h.renew(c)
    default:
        c.JSON(400, gin.H{"error": "unknown action"})
    }
}
```

### Action Specs
```
GET /api/?key=&action=get_all_services
Response: [{id, name, price, timeout}, ...]

GET /api/?key=&action=get_number&id={provider_id}
  → deduct balance
  → sync call GetPhone (NOT async - API caller needs phone immediately)
  → Response success: {number: "0901234567", request_id: "14159265"}
  → Response fail balance: {message: "Your balance is not enough!"}
  → Response fail other: {message: "error description"}

GET /api/?key=&action=get_code&id={request_id}
  → lookup transaction by request_id + user_id
  → status=success:        {otp_code: "142857"}
  → status=waiting_otp:   {otp_code: "is_comming"}
  → status=failed/timeout: {otp_code: "timeout"}

GET /api/?key=&action=renew&id={request_id}
  → lookup transaction, verify ownership
  → if waiting_otp: cancel → refund → new get_number same provider
  → Response: {success: true, message: "Successfully!", number: "...", request_id: "..."}
  → Response fail: {success: false, message: "error"}
```

### GetNumber Sync Flow (differs from Phase 03 async)
For public API, `get_number` must be synchronous (caller needs phone immediately):
```go
// In service layer - sync version for API
func (s *OTPService) InitiateOTPSync(userID, providerID uint) (*PhoneResult, error) {
    // 1. DeductBalance (atomic SQL)
    // 2. CreateTransaction (status=pending)
    // 3. Call GetPhone directly (sync, no Asynq)
    // 4. Update transaction status=waiting_otp
    // 5. Enqueue PollOTP job (async from here)
    // 6. Return phone + request_id
}
```

## Related Code Files
| File | Action |
|------|--------|
| `internal/handler/public_api_handler.go` | create |
| `internal/service/otp_service.go` | modify - add `InitiateOTPSync` |
| `cmd/api/main.go` | modify - register `GET /api/` route |

## Implementation Steps
1. Write `internal/handler/public_api_handler.go` with `Handle()` dispatcher
2. Implement `getServices()`: query active providers, return `[{id, name, price, timeout}]`
3. Implement `getNumber()`: call `InitiateOTPSync`, handle balance/provider errors
4. Implement `getCode()`: query transaction by `request_id` + `user_id`, map status → response
5. Implement `renew()`: cancel transaction → refund → call `InitiateOTPSync` again
6. Add `InitiateOTPSync` to `otp_service.go` (sync phone fetch, async OTP poll)
7. Register route in `cmd/api/main.go`:
   ```go
   api := router.Group("/api")
   api.Use(middleware.APIKeyAuth())
   api.GET("/", publicAPIHandler.Handle)
   ```
8. Test all 4 actions with curl

## Todo List
- [ ] Implement `getServices` action
- [ ] Implement `getNumber` action (sync phone fetch)
- [ ] Implement `getCode` action (status mapping)
- [ ] Implement `renew` action (cancel + refund + re-initiate)
- [ ] Add `InitiateOTPSync` to otp_service
- [ ] Register `/api/` route with APIKey middleware
- [ ] Test: get_all_services returns provider list
- [ ] Test: get_number returns phone + request_id
- [ ] Test: get_code returns is_comming then otp_code
- [ ] Test: get_number with zero balance returns error message

## Success Criteria
- `curl "/api/?key=X&action=get_all_services"` returns JSON array
- `curl "/api/?key=X&action=get_number&id=1"` returns `{number, request_id}`
- `curl "/api/?key=X&action=get_code&id=14159"` returns `{otp_code: "is_comming"}` then OTP
- Invalid key returns `{"error": "unauthorized"}`
- Insufficient balance returns `{"message": "Your balance is not enough!"}`

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Sync GetPhone blocks HTTP request too long | Set 15s HTTP timeout on provider client for sync calls |
| `renew` race: concurrent renew calls | Check transaction status before renewing; use DB lock |
| request_id not unique across users | Always filter by `user_id AND request_id` |

## Security Considerations
- API Key from query param `?key=` - acceptable (matches otptextnow.com style, HTTPS in prod)
- `get_code` must verify transaction `user_id` matches API key owner - no data leakage between users
- `renew` must verify ownership before refund

## Next Steps
Phase 05: User Web Dashboard (React frontend)
