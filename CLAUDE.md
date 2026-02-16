# CLAUDE.md - Guidelines for Monorepo (User App Template)

## Overview

This is the **monorepo template** for all user applications on the Anything platform. When a user creates an app on Anything, this codebase is what runs inside the E2B sandbox to host and serve their app. It contains both a web runtime (React Router SSR) and a mobile runtime (Expo/React Native).

Code in `src/__create/` and `src/app/__create/` is platform infrastructure (sandbox communication, HMR, error boundaries, fetch interception). Code outside those directories is user-land — the template surface that user-generated code builds on top of.

## Project Structure

- **Not** a workspaces monorepo — each app is independent with its own `node_modules`
- Root `package.json` only contains Biome for repo-wide linting/formatting
- Package manager: web uses Bun for install/dev, mobile uses npm

```
apps/
  web/          # React Router 7 SSR app (Vite + Hono server)
  mobile/       # Expo 54 / React Native 0.81 app
examples/       # Example user projects (api-todo, web-errors, mobile-errors, etc.)
config/         # Deployment infra (supervisord, Vector logging, healthcheck)
.github/        # CI/CD workflows and CODEOWNERS
```

### Key Directories

- `apps/web/src/__create/` — Platform plumbing: fetch interception, HMR, console-to-parent bridge, dev error overlay
- `apps/web/src/app/` — React Router file-based routes; `root.tsx` contains error boundaries and sandbox messaging
- `apps/web/src/app/api/` — Server-side API routes
- `apps/mobile/src/app/` — Expo Router file-based routes
- `apps/mobile/src/__create/` — Platform plumbing for mobile
- `examples/` — Reference implementations for user app patterns (ignored by Biome)

## Build/Lint/Test Commands

### Linting & Formatting (run from repo root)

```bash
# Format (auto-fix)
npx @biomejs/biome format --write .

# Lint (auto-fix)
npx @biomejs/biome check --fix .
```

### Web App (`apps/web/`)

```bash
bun dev                              # Dev server (port 4000)
react-router typegen && tsc --noEmit # Typecheck (generates route types first)
npx vitest                           # Run tests (Vitest + jsdom)
npx vitest path/to/test.ts           # Run single test
```

### Mobile App (`apps/mobile/`)

```bash
bunx expo start --offline --web      # Dev server
npx jest                             # Run tests (Jest + jest-expo)
```

## Code Style

- TypeScript with `strict: true` in both apps
- Path aliases: `@/*` maps to `./src/*`
- Tailwind CSS for styling (no CSS modules)
- Biome for linting and formatting (not ESLint/Prettier):
  - Single quotes, semicolons always, trailing commas (ES5)
  - 100 character line width, 2-space indentation
- React function components with hooks
- PascalCase for components/types, camelCase for variables/functions
- Do not include JSDoc comments for props interfaces
- Prefer named parameters (object destructuring) for functions with multiple params
- Avoid boolean parameters — use descriptive alternatives
- Avoid optional parameters; prefer `param: string | null` over `param?: string`
- Use guard clauses to return early instead of deep nesting
- Comments should explain *why*, not *what*

### State Management

- **Zustand** for client-side state
- **TanStack React Query** for async/server state
- **react-hook-form** with **Yup** for form validation

### UI Libraries

- **Web**: Chakra UI, @lshay/ui, Lucide React (icons), React Aria (accessibility)
- **Mobile**: Lucide React Native (icons), Gorhom Bottom Sheet, Moti (animations), React Native Reanimated

### Error Handling

- Custom error boundaries in `root.tsx` communicate errors to the parent Anything platform via `postMessage`
- `serialize-error` for safe error serialization
- Sonner for toast notifications (web), sonner-native (mobile)
- Errors are sent to the parent window for the "Try to fix" AI flow

## E2B Deployment

Apps are deployed as E2B sandbox templates. Each environment has its own config:

- `e2b.development.beta.toml` — Dev/beta
- `e2b.staging.toml` — Staging
- `e2b.production.toml` — Production
- `e2b.local.toml` — Local development (git-ignored)

Template rollout is controlled via LaunchDarkly feature flags (`e2b-monorepo-template`).

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New features or capabilities
- `fix:` — Bug fixes
- `chore:` — Maintenance, dependency updates
- `refactor:` — Code restructuring without behavior change
- `docs:` — Documentation changes
- `test:` — Test additions or updates

Examples:
- `feat: push ssr errors`
- `fix: react native web maps polyfill issue`
- `chore: daily beta`

Keep commit messages concise and focus on *why* the change was made.

## Workflow Best Practices

- Install dependencies from within each app directory (`cd apps/web && bun install`)
- **After writing/editing code, always run:**
  1. `npx @biomejs/biome format --write .` (from repo root)
  2. `npx @biomejs/biome check --fix .` (from repo root)
  3. Typecheck the relevant app (`cd apps/web && react-router typegen && tsc --noEmit`)


