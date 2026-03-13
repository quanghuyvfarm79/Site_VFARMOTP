# VFRAMOTP - OTP Selling Site Implementation Plan
> Date: 2026-03-12 | Status: Planning | Repo: quanghuyvfarm79/vframotp

## Project Summary
Rebuild OTP-selling site from scratch in Go (replacing Laravel/PHP `rent.otp`). Full stack: Go+Gin API, React+TS+Tailwind frontend, PostgreSQL, Asynq+Redis worker, Nginx.

## Tech Stack
| Layer | Choice |
|-------|--------|
| API | Go + Gin |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| DB | PostgreSQL 16 |
| Queue | Asynq + Redis 7 |
| Auth | JWT (web) + API Key (third-party) |
| ORM | GORM |
| Migrations | golang-migrate |
| Build | Makefile |

## Environments
| Env | OS | Purpose |
|-----|----|---------|
| Windows 10 | Docker Desktop (PG+Redis) | Dev/Code |
| VMware Ubuntu 24.04 | Go binary + PG + Redis + Nginx | Test |
| VPS Ubuntu 24.04 (14.225.205.212) | Same + SSL | Staging/Public |

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 01 | Environment Setup & Project Scaffold | ✅ done | [phase-01-env-setup.md](./phase-01-env-setup.md) |
| 02 | Database & Auth | pending | [phase-02-database-auth.md](./phase-02-database-auth.md) |
| 03 | OTP Core Engine | pending | [phase-03-otp-engine.md](./phase-03-otp-engine.md) |
| 04 | Public API | pending | [phase-04-public-api.md](./phase-04-public-api.md) |
| 05 | User Web Dashboard | pending | [phase-05-user-dashboard.md](./phase-05-user-dashboard.md) |
| 06 | Admin Panel | pending | [phase-06-admin-panel.md](./phase-06-admin-panel.md) |
| 07 | Deployment | pending | [phase-07-deployment.md](./phase-07-deployment.md) |

## Key Dependencies (execution order)
```
01 (scaffold) → 02 (DB+auth) → 03 (OTP engine) → 04 (public API)
                                                  → 05 (user dashboard)
                                                  → 06 (admin panel)
04+05+06 → 07 (deployment)
```

## Out of Scope (Phase 3 / YAGNI)
- SePay webhook (auto top-up)
- Telegram notification
- Excel export
- 2FA

## Research Reports
- [researcher-01-backend-stack.md](./research/researcher-01-backend-stack.md)
- [researcher-02-frontend-deployment.md](./research/researcher-02-frontend-deployment.md)

## Reference Codebase
- `rent.otp/app/Services/RentOtpService.php` - legacy OTP flow business logic
