# Frontend & Deployment Research: React + TypeScript + Vite Stack

**Date**: 2026-03-12
**Stack**: React + TypeScript + Tailwind CSS + Vite + Nginx + Ubuntu 24.04
**Author**: Technical Research Team

---

## 1. Vite + React + TypeScript Project Structure (2025 Best Practices)

**Key Principle**: Feature/domain-based organization, NOT file-type organization.

### Recommended Directory Layout
```
src/
├── components/          # Reusable UI components
├── pages/              # Route-level page components
├── hooks/              # Custom React hooks
├── services/           # API services & integrations
├── store/              # State management (Zustand/Redux)
├── styles/             # Global styles
├── types/              # TypeScript definitions
├── utils/              # Utility functions
├── config/             # Configuration files
└── assets/             # Images, fonts
```

### Configuration Best Practices
- **Path Aliases**: Use `@/` for src root, `@components/`, `@hooks/` in vite.config.ts for cleaner imports
- **Code Quality**: Configure ESLint + Prettier; Vite's instant feedback catches issues during dev
- **Naming Conventions**: kebab-case files, PascalCase components, camelCase functions
- **Modularization**: Each component includes its styles and tests
- **TypeScript**: Strict mode enabled in tsconfig.json for type safety

**Benefit**: Scales from small dashboards to enterprise apps with minimal refactoring.

---

## 2. Tailwind CSS Glassmorphism Implementation

**Core Utilities for Glassmorphism Effect**:
```html
<div class="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-6 shadow-lg">
  Content
</div>
```

### Key CSS Properties
- `backdrop-blur-*`: Creates the frosted glass effect (blur-sm to blur-3xl)
- `bg-white/10`: Semi-transparent white background (opacity variants: /5, /10, /20, /30)
- `border-white/20`: Light borders with transparency for subtle definition
- `shadow-lg`: Adds depth; combine with backdrop-blur for elevation effect
- `rounded-lg`: Smooth corners essential for glassmorphism aesthetics

### Best Practices
- Ensure sufficient contrast for accessibility; use `text-white` or dark text depending on background
- Layer multiple glass elements with slight opacity differences for depth
- Combine with dark theme backgrounds (e.g., `bg-slate-900`) for best visual impact
- Use `supports-backdrop-filter` media query for browser support fallback

---

## 3. React Router v7 Role-Based Routing

**Recommended Pattern**: Centralized role checks in route configuration + Protected Route wrapper.

### Implementation Strategy
```typescript
// ProtectedRoute component with role check
interface ProtectedRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { userRole, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!allowedRoles.includes(userRole)) return <Navigate to="/unauthorized" />;

  return <>{children}</>;
};
```

### Route Configuration
- Define route metadata with `allowedRoles` prop
- Use `useLoaderData()` to access user info from root loader (React Router v7 pattern)
- Generate navigation links dynamically based on user role
- Implement fallback pages: `/login`, `/unauthorized`

### Best Practices
- Enforce authentication at root loader level
- Never rely on client-side checks alone for security
- Backend API must validate roles before returning sensitive data
- Use Context API or state management for auth state (useAuth hook)

---

## 4. Axios JWT + API Key Authentication Setup

### Request Interceptor Pattern
```typescript
// Add JWT to every request
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Response Interceptor with Token Refresh
```typescript
let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const { config } = error;

    if (error.response?.status === 401 && !isRefreshing) {
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken(); // Call refresh endpoint
        localStorage.setItem('accessToken', newToken);

        // Retry original request with new token
        config.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(config);
      } catch {
        // Refresh failed - redirect to login
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

### Critical Best Practices
- **Token Storage**: Access token in localStorage, refresh token in httpOnly cookies
- **Prevent Infinite Loops**: Use separate axios instance for token refresh requests
- **Queue Failed Requests**: Buffer requests during token refresh to prevent race conditions
- **Handle Refresh Failure**: Gracefully redirect to login if refresh token expires
- **CSRF Protection**: Use httpOnly, Secure, SameSite=Strict for refresh token cookies

---

## 5. Nginx Configuration: React SPA + Go API Reverse Proxy

### Production Nginx Config
```nginx
server {
    listen 80;
    server_name _;

    # Serve React static files
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Cache static assets (js, css, images)
    location ~* \.(js|css|png|jpg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Reverse proxy to Go API on port 8080
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA routing: fallback to index.html for client-side routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
}
```

### Key Directives
- `try_files $uri $uri/ /index.html`: Critical for React Router SPA navigation
- `proxy_pass http://localhost:8080`: Routes /api/* to Go backend
- `proxy_set_header`: Preserves client info for backend logging/auth
- `expires 1y`: Cache busting for versioned assets
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options

---

## 6. Docker Compose: Local Dev Stack (PostgreSQL + Redis)

### docker-compose.yml Template
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: siteotp
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    environment:
      DATABASE_URL: postgresql://app:secret@postgres:5432/siteotp
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "8080:8080"

volumes:
  postgres_data:
  redis_data:
```

### Benefits
- Zero local installation of Postgres/Redis
- `docker-compose up` spins entire stack in seconds
- Health checks prevent race conditions
- `depends_on: condition: service_healthy` ensures proper startup order

---

## 7. Monorepo Makefile Patterns (Go + React)

### Recommended Makefile Structure
```makefile
.PHONY: help dev build test deploy clean

# Development targets
dev:
	docker-compose up -d
	(cd frontend && npm run dev) &
	(cd backend && go run ./cmd/main.go)

# Build targets
build: build-frontend build-backend

build-frontend:
	cd frontend && npm run build

build-backend:
	cd backend && CGO_ENABLED=0 GOOS=linux go build -o bin/app ./cmd/main.go

# Testing
test:
	cd frontend && npm run test
	cd backend && go test ./...

# Deployment
deploy: build
	docker build -f Dockerfile.prod -t siteotp:latest .
	docker push siteotp:latest
	# Deploy to production (e.g., kubectl, docker swarm)

# Cleanup
clean:
	docker-compose down
	rm -rf frontend/dist backend/bin
```

### Best Practices
- Separate build targets for frontend/backend
- Single `dev` command starts all services
- Use `docker-compose.override.yml` for local customizations
- Include health check targets for CI/CD validation

---

## Summary Table

| Topic | Key Decision | Benefit |
|-------|--------------|---------|
| **Project Structure** | Feature-based organization + path aliases | Scales to enterprise complexity |
| **Glassmorphism** | `backdrop-blur-md bg-white/10 border-white/20` | Modern, accessible UI |
| **Routing** | Protected routes + root loader auth | Type-safe role checks |
| **Auth** | JWT (localStorage) + refresh in httpOnly cookies | XSS/CSRF protection + seamless UX |
| **Nginx** | Reverse proxy + try_files fallback | Static serving + API routing + SPA support |
| **Local Dev** | Docker Compose with health checks | Zero setup, reproducible environment |
| **Monorepo** | Makefile for unified build/deploy | Single command orchestration |

---

## Sources

- [Complete Guide to Setting Up React with TypeScript and Vite (2026)](https://medium.com/@robinviktorsson/complete-guide-to-setting-up-react-with-typescript-and-vite-2025-468f6556aaf2)
- [Best Practices for React.js with Vite and TypeScript](https://medium.com/@taedmonds/best-practices-for-react-js-with-vite-and-typescript-what-i-use-and-why-f4482558ed89)
- [React Folder Structure with Vite & TypeScript](https://medium.com/@prajwalabraham.21/react-folder-structure-with-vite-typescript-beginner-to-advanced-9cd12d1d18a6)
- [Role-Based Route Permissions in React Router v7](https://dev.to/princetomarappdev/role-based-route-permissions-in-remix-react-router-v7-1d3j)
- [Building Reliable Protected Routes with React Router v7](https://dev.to/ra1nbow1/building-reliable-protected-routes-with-react-router-v7-1ka0)
- [Using NGINX to Serve React Application](https://dev.to/mohammadfaisal/using-nginx-to-serve-react-application-static-vs-reverse-proxy-2o8l)
- [How To Deploy a React Application with Nginx on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-deploy-a-react-application-with-nginx-on-ubuntu-20-04)
- [JWT Token Refresh using Axios Interceptors](https://medium.com/@krishnanand654/jwt-token-refresh-using-axios-interceptors-03ad9fa74d77)
- [Token Refresh with Axios Interceptors for Seamless Authentication](https://medium.com/@velja/token-refresh-with-axios-interceptors-for-a-seamless-authentication-experience-854b06064bde)
- [Managing JWT Access Tokens with Axios and Automatic Token Refresh](https://dev.to/imzihad21/managing-jwt-access-tokens-with-axios-and-automatic-token-refresh-1i5p)
- [Using Redis with Docker Compose for Local Development](https://geshan.com.np/blog/2022/01/redis-docker/)
- [NestJS + Redis + Postgres Local Development With Docker Compose](https://www.tomray.dev/nestjs-docker-compose-postgres)
- [Postgres and Redis Containers with Docker Compose](https://sevic.dev/notes/postgres-redis-docker-compose/)
- [How to Use Docker Compose for Local Development Environments](https://oneuptime.com/blog/post/2026-02-20-docker-compose-development/view)

---

**Report Status**: Complete - 7 research topics covered, ready for implementation.
