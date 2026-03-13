# Phase 06 - Admin Panel

## Context Links
- Plan: [plan.md](./plan.md)
- Phase 02: [phase-02-database-auth.md](./phase-02-database-auth.md) (role middleware)
- Phase 05: [phase-05-user-dashboard.md](./phase-05-user-dashboard.md) (shared components)

## Overview
- **Date**: 2026-03-12
- **Priority**: Medium
- **Status**: pending
- Admin-only section: dashboard stats, user management, provider CRUD, transaction overview

## Key Insights
- Reuse Phase 05 `GlassCard`, `Navbar`, `ProtectedRoute` components - no duplication
- Role check: frontend `ProtectedRoute allowedRoles={["admin"]}` + backend role middleware (both layers)
- Revenue stats: simple SQL aggregates - no separate analytics DB needed (YAGNI)
- Charts: use `recharts` library - lightweight, React-native, no heavy D3 setup
- Manual top-up: admin adds balance directly via API - no payment gateway (Phase 1 requirement)
- Provider CRUD: full create/read/update/delete for providers table, including phone_list upload

## Requirements
- Admin route group `/admin/*` protected by JWT + role=admin middleware
- Dashboard: total revenue (sum of successful transactions), OTP success/fail count, active users
- User management: list all users, view detail, add balance, toggle active
- Provider management: CRUD, toggle active, phone list management
- Transaction overview: all users' transactions with filters (date, status, user, provider)

## Architecture

### Backend Routes (`internal/handler/admin_handler.go`)
```
GET  /admin/stats                    → revenue, success/fail counts, active users
GET  /admin/users                    → paginated user list
GET  /admin/users/:id                → user detail + balance logs
POST /admin/users/:id/add-balance    → {amount, note}
PUT  /admin/users/:id/toggle-active  → toggle active bool
GET  /admin/providers                → list all providers
POST /admin/providers                → create provider
PUT  /admin/providers/:id            → update provider
DELETE /admin/providers/:id          → soft delete (set active=false)
POST /admin/providers/:id/phones     → bulk upload phone list (CSV body)
GET  /admin/transactions             → paginated, filters: ?user_id=&status=&from=&to=
```

### Stats Query
```sql
-- Revenue (successful only)
SELECT COALESCE(SUM(amount), 0) AS revenue,
       COUNT(*) FILTER (WHERE status = 'success') AS success_count,
       COUNT(*) FILTER (WHERE status = 'failed')  AS fail_count,
       COUNT(*) AS total
FROM transactions
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Active users (transacted in last 30 days)
SELECT COUNT(DISTINCT user_id) FROM transactions
WHERE created_at >= NOW() - INTERVAL '30 days';
```

### Frontend Admin Routes
```
/admin/dashboard       → stats cards + charts
/admin/users           → user list table
/admin/users/:id       → user detail + add balance form
/admin/providers       → provider list + create/edit modal
/admin/transactions    → all transactions with filters
```

### Frontend Components (new, admin-specific)
```
src/pages/admin/
├── AdminDashboardPage.tsx    # stats cards + recharts BarChart
├── AdminUsersPage.tsx        # user table + search
├── AdminUserDetailPage.tsx   # balance logs + add balance form
├── AdminProvidersPage.tsx    # provider CRUD table + modal form
└── AdminTransactionsPage.tsx # transactions with filter bar

src/components/admin/
├── StatsCard.tsx             # revenue/count card
├── ProviderFormModal.tsx     # create/edit provider form
└── AddBalanceModal.tsx       # add balance dialog
```

### Provider Form Fields
```
name          text
url           text (get phone URL)
url_otp       text (get OTP URL, request_id appended)
key_phone     text (JSON path, e.g. "data.phone")
key_req_id    text (JSON path)
key_otp       text (JSON path)
fee           number (VND)
timeout       number (seconds)
time_delay    number (seconds)
use_phone_list checkbox
active        toggle
```

### Add Balance Flow
```
Admin fills amount (VND) + note
→ POST /admin/users/:id/add-balance {amount, note}
→ Backend: UPDATE users SET balance=balance+amount; INSERT balance_logs
→ Frontend: refresh user detail
```

## Related Code Files
| File | Action |
|------|--------|
| `internal/handler/admin_handler.go` | create |
| `internal/service/admin_service.go` | create |
| `internal/repository/admin_repo.go` | create (stats queries) |
| `cmd/api/main.go` | modify - register /admin/* routes |
| `frontend/src/pages/admin/AdminDashboardPage.tsx` | create |
| `frontend/src/pages/admin/AdminUsersPage.tsx` | create |
| `frontend/src/pages/admin/AdminUserDetailPage.tsx` | create |
| `frontend/src/pages/admin/AdminProvidersPage.tsx` | create |
| `frontend/src/pages/admin/AdminTransactionsPage.tsx` | create |
| `frontend/src/components/admin/ProviderFormModal.tsx` | create |
| `frontend/src/components/admin/AddBalanceModal.tsx` | create |
| `frontend/src/App.tsx` | modify - add admin routes |
| `frontend/package.json` | modify - add recharts |

## Implementation Steps
1. Add `npm install recharts` to frontend
2. Write `internal/handler/admin_handler.go` with all admin endpoints
3. Write `internal/service/admin_service.go`: stats aggregation, balance addition
4. Write `internal/repository/admin_repo.go`: paginated queries with filters
5. Register `/admin/*` routes in `cmd/api/main.go` with JWT + role=admin middleware
6. Build `AdminDashboardPage`: 4 stats cards + bar chart (daily success/fail last 7 days)
7. Build `AdminUsersPage`: searchable table, link to user detail
8. Build `AdminUserDetailPage`: balance logs + `AddBalanceModal`
9. Build `AdminProvidersPage`: table + `ProviderFormModal` for create/edit
10. Build `AdminTransactionsPage`: table with filter bar (date range, status dropdown)
11. Add admin routes to `App.tsx` with `ProtectedRoute allowedRoles={["admin"]}`
12. Test: non-admin user cannot access /admin/* (frontend redirect + backend 403)

## Todo List
- [ ] Install recharts
- [ ] Write admin handler (all endpoints)
- [ ] Write admin service (stats, balance add)
- [ ] Write admin repository (paginated queries)
- [ ] Register admin routes with role middleware
- [ ] Build AdminDashboardPage (stats + chart)
- [ ] Build AdminUsersPage (list + search)
- [ ] Build AdminUserDetailPage (add balance)
- [ ] Build AdminProvidersPage (CRUD + modal)
- [ ] Build AdminTransactionsPage (filtered list)
- [ ] Add admin routes to App.tsx
- [ ] Test role protection (both layers)

## Success Criteria
- `/admin/stats` returns revenue + counts
- Admin can add balance: user balance increases, balance_log created
- Provider CRUD: create/update/delete works; active toggle disables provider for new OTPs
- Non-admin JWT → GET /admin/stats → 403
- Non-admin frontend → navigates to /unauthorized
- Transaction filter by status + date returns correct subset

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Stats query slow on large data | Add index on `transactions(created_at, status)`; acceptable at this scale |
| Admin add balance negative amount | Validate amount > 0 in handler |
| Provider delete with active transactions | Soft delete only (active=false); transactions keep provider_id |

## Security Considerations
- Both frontend (`ProtectedRoute`) and backend (role middleware) enforce admin check - defense in depth
- Balance addition: server-side only, no client can self-top-up via this endpoint
- Phone list CSV upload: validate phone format, limit file size (1MB max)
- All admin actions should be logged (note field on balance_log is minimum)

## Next Steps
Phase 07: Deployment (VMware + VPS setup, Nginx, systemd, SSL)
