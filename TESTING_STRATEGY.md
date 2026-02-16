# Testing Strategy

This document outlines the testing strategy for the dev server monorepo.

## Philosophy

Tests are **external to the user app** - they test the dev server from the outside, like a real user would. This approach:

- Doesn't pollute the user's codebase with test infrastructure
- Tests the actual running server (Docker container or local)
- Catches integration issues between components
- Is excluded from Docker builds via `.dockerignore`

## Test Location

```
tests/                    # External test suite (NOT included in Docker)
├── package.json          # Test dependencies (Playwright)
├── playwright.config.ts  # Test configuration
├── e2e/                  # End-to-end tests
│   ├── healthcheck.spec.ts
│   ├── web-server.spec.ts
│   ├── api-routes.spec.ts
│   └── mobile-server.spec.ts
└── fixtures/             # Test data and fixtures
```

## What We Test

### 1. Healthcheck Service (Port 9000)

- `/healthz` endpoint returns proper JSON structure
- Status reflects actual service health
- Unknown paths return 404

### 2. Web Dev Server (Port 4000)

- Homepage renders without errors
- Error handling (404s, 500s don't crash server)
- Response headers are correct
- SSR works properly

### 3. API Routes

- Auth endpoints (`/api/auth/*`) respond correctly
- Body size limits enforced (4.5MB)
- CORS headers when configured
- Route discovery and registration works

### 4. Mobile Dev Server (Port 8081)

- Metro bundler is responsive
- Status endpoint works

### 5. Integrations Proxy

- Requests to `/integrations/*` are proxied correctly

## Running Tests

### Prerequisites

```bash
cd tests
npm install
npx playwright install chromium
```

### Against Local Dev Server

Start the dev server first, then run tests:

```bash
# Terminal 1: Start the server
cd apps/web && bun dev

# Terminal 2: Run tests
cd tests && npm test
```

### Against Docker Container

```bash
# Start the Docker container
docker compose up -d

# Run tests against Docker
cd tests
DEV_SERVER_URL=http://localhost:4000 \
HEALTHCHECK_URL=http://localhost:9000 \
MOBILE_SERVER_URL=http://localhost:8081 \
npm test
```

### Test Options

```bash
npm test              # Run all tests headless
npm run test:headed   # Run with browser visible
npm run test:ui       # Interactive UI mode
npm run test:debug    # Debug mode with inspector
npm run test:report   # View HTML report
```

## Configuration

Environment variables for test configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_SERVER_URL` | `http://localhost:4000` | Web server URL |
| `HEALTHCHECK_URL` | `http://localhost:9000` | Healthcheck service URL |
| `MOBILE_SERVER_URL` | `http://localhost:8081` | Mobile/Expo server URL |

## Test Categories

| Category | Priority | Description |
|----------|----------|-------------|
| Healthcheck | High | Core infrastructure monitoring |
| Web Server | High | Main dev server functionality |
| API Routes | High | Backend functionality |
| Auth Flow | Medium | Authentication system |
| Mobile Server | Medium | Expo/Metro bundler |
| Integrations | Lower | Third-party proxy |

