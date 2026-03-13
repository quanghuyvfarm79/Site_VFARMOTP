# Phase 05 - User Web Dashboard (React Frontend)

## Context Links
- Plan: [plan.md](./plan.md)
- Research: [researcher-02-frontend-deployment.md](./research/researcher-02-frontend-deployment.md)
- UI reference: otptextnow.com (glassmorphism, purple-pink gradient)

## Overview
- **Date**: 2026-03-12
- **Priority**: High
- **Status**: pending
- React + TypeScript + Tailwind frontend: login/register + user dashboard + OTP request flow

## Key Insights
- Glassmorphism: `backdrop-blur-md bg-white/10 border border-white/20` on dark gradient background
- Purple-pink gradient bg: `bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900`
- React Router v7 protected routes: `useAuth()` hook + `<ProtectedRoute>` wrapper
- Access token in localStorage (15min), no refresh token needed for simplicity (re-login on expire)
- Axios instance with request interceptor adds Bearer token automatically
- OTP request flow: select provider → click "Get Number" → show phone → poll `get_code` every 5s → show OTP
- No real-time WebSocket needed: frontend polling via `setInterval` is sufficient

## Requirements
- Login + Register pages (public routes)
- User dashboard: balance display, API key section, recent transactions
- OTP request page: select service → get phone → countdown + OTP display
- Role-based routing: `user` routes vs `admin` routes (admin in Phase 06)
- Axios API client configured with base URL + auth interceptor

## Architecture

### Route Structure
```
/ (redirect to /dashboard)
/login                    → public
/register                 → public
/dashboard                → ProtectedRoute (any authenticated user)
/otp                      → ProtectedRoute (user role)
/transactions             → ProtectedRoute (user role)
/admin/*                  → ProtectedRoute (admin role) [Phase 06]
```

### Directory Structure (`frontend/src/`)
```
src/
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx
│   ├── OTPPage.tsx
│   └── TransactionsPage.tsx
├── components/
│   ├── GlassCard.tsx        # reusable glassmorphism card
│   ├── Navbar.tsx
│   ├── ProtectedRoute.tsx
│   └── OTPStatusBadge.tsx   # pending/success/failed badge
├── hooks/
│   ├── useAuth.ts           # auth state + login/logout
│   └── useOTP.ts            # OTP flow state machine
├── services/
│   └── api.ts               # axios instance + all API calls
├── types/
│   └── index.ts             # TypeScript interfaces
└── App.tsx                  # router setup
```

### Glassmorphism Base Component
```tsx
// components/GlassCard.tsx
export const GlassCard: React.FC<{children: React.ReactNode; className?: string}> = ({children, className}) => (
  <div className={`backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-xl ${className}`}>
    {children}
  </div>
);

// Page background wrapper
// <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900">
```

### Auth Hook (`hooks/useAuth.ts`)
```typescript
interface AuthState {
  user: {id: number; email: string; role: string; balance: number} | null;
  token: string | null;
}

export function useAuth() {
  // Read from localStorage on init
  // login(email, password): POST /auth/login → store token + user
  // logout(): clear localStorage → redirect to /login
  // isAuthenticated: !!token
}
```

### API Service (`services/api.ts`)
```typescript
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: clear storage + redirect to /login
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', {email, password}),
  register: (email, password) => api.post('/auth/register', {email, password}),
  getAPIKey: () => api.get('/auth/apikey'),
};

export const userAPI = {
  getTransactions: () => api.get('/user/transactions'),
  getProfile: () => api.get('/user/profile'),
};

// Public API calls (use api_key from user profile)
export const otpAPI = {
  getServices: (key) => api.get(`/?key=${key}&action=get_all_services`),
  getNumber: (key, id) => api.get(`/?key=${key}&action=get_number&id=${id}`),
  getCode: (key, id) => api.get(`/?key=${key}&action=get_code&id=${id}`),
};
```

### OTP Page Flow
```
1. Load services list (getServices)
2. User selects service → clicks "Get Number"
3. Call getNumber → show phone number + request_id
4. Start setInterval(5000): call getCode
5. Display: countdown timer (timeout - elapsed), status badge
6. On OTP received: show OTP prominently, clear interval
7. On timeout: show "Timeout - balance refunded"
```

### Backend Endpoints Needed (add to Phase 02/03)
```
GET  /user/profile        → {id, email, role, balance, api_key}
GET  /user/transactions   → [{id, phone, otp, status, amount, created_at}] paginated
```

## Related Code Files
| File | Action |
|------|--------|
| `frontend/src/App.tsx` | modify - add all routes |
| `frontend/src/pages/LoginPage.tsx` | create |
| `frontend/src/pages/RegisterPage.tsx` | create |
| `frontend/src/pages/DashboardPage.tsx` | create |
| `frontend/src/pages/OTPPage.tsx` | create |
| `frontend/src/pages/TransactionsPage.tsx` | create |
| `frontend/src/components/GlassCard.tsx` | create |
| `frontend/src/components/ProtectedRoute.tsx` | create |
| `frontend/src/components/Navbar.tsx` | create |
| `frontend/src/hooks/useAuth.ts` | create |
| `frontend/src/hooks/useOTP.ts` | create |
| `frontend/src/services/api.ts` | create |
| `frontend/src/types/index.ts` | create |
| `internal/handler/user_handler.go` | create - profile + transactions |
| `cmd/api/main.go` | modify - register user routes |

## Implementation Steps
1. Configure Tailwind with purge paths in `tailwind.config.js`
2. Write `types/index.ts`: `User`, `Transaction`, `Provider`, `OTPStatus` interfaces
3. Write `services/api.ts`: axios instance + interceptors + API functions
4. Write `hooks/useAuth.ts`: auth state management with localStorage
5. Write `components/GlassCard.tsx`, `ProtectedRoute.tsx`, `Navbar.tsx`
6. Write `LoginPage.tsx` and `RegisterPage.tsx` (glassmorphism forms)
7. Write `DashboardPage.tsx`: balance card, API key display (copy button), recent transactions
8. Write `OTPPage.tsx`: service selector, get number flow, polling loop, OTP display
9. Write `TransactionsPage.tsx`: table with status badges, pagination
10. Set up React Router in `App.tsx`
11. Add backend `GET /user/profile` and `GET /user/transactions` endpoints
12. Run `npm run dev` + test all pages

## Todo List
- [ ] Configure Tailwind + global styles
- [ ] Define TypeScript interfaces
- [ ] Build axios API client with auth interceptor
- [ ] Implement `useAuth` hook
- [ ] Build `GlassCard`, `Navbar`, `ProtectedRoute` components
- [ ] Build `LoginPage` + `RegisterPage`
- [ ] Build `DashboardPage`
- [ ] Build `OTPPage` with polling loop
- [ ] Build `TransactionsPage`
- [ ] Set up routes in `App.tsx`
- [ ] Add backend `/user/profile` + `/user/transactions` endpoints
- [ ] Test full OTP flow in browser

## Success Criteria
- Login form submits → JWT stored → redirected to dashboard
- Dashboard shows balance and API key
- OTP page: select service → get phone → OTP appears within provider timeout
- 401 response auto-redirects to login
- `npm run build` produces `frontend/dist/` with no errors

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Polling too aggressive (5s interval) | Clear interval on component unmount; use `useEffect` cleanup |
| Token expiry mid-session (24h JWT) | Response interceptor catches 401, redirects to login cleanly |
| CORS during dev (Vite :5173 → API :8080) | Configure Vite proxy in `vite.config.ts` |

## Security Considerations
- Token in localStorage: acceptable trade-off (no httpOnly for simplicity at this scale)
- Copy API key button: show only partial key in UI, full key shown once on generation
- No sensitive data in React state that persists beyond session

## Next Steps
Phase 06: Admin Panel (user management, provider CRUD, revenue stats)
