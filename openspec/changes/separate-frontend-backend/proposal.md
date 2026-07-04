## Why

The `initial-project-scaffold` change planned a flat project structure with all source code under a single `src/` directory. However, Wanderloop has a clear client-server split: a React SPA frontend and a Node/Express (or FastAPI) backend for the Claude AI tool-calling loop. Separating them into distinct `client/` and `server/` folders now — before any code is written — avoids a painful refactor later, enables independent dependency management, and makes it possible to deploy, scale, and test each side independently.

## What Changes

- **BREAKING** — Restructure the project as a monorepo with two top-level packages: `client/` (Vite + React frontend) and `server/` (Node.js/Express backend).
- Add a root `package.json` with npm workspaces pointing to `client/` and `server/`.
- Move all frontend code, config, and dependencies into `client/`.
- Scaffold a minimal `server/` package with Express, TypeScript, dotenv, and a health-check endpoint.
- Share TypeScript domain model types between client and server via a `shared/` directory (or package).
- Update the `initial-project-scaffold` tasks to reference the new folder structure.

## Capabilities

### New Capabilities
- `monorepo-structure`: npm workspaces monorepo with `client/`, `server/`, and `shared/` directories, each with their own `package.json` and build tooling.
- `backend-scaffold`: Minimal Express + TypeScript backend server with dotenv, a health-check route, and CORS configured for the dev frontend.
- `shared-types`: Shared TypeScript package (`shared/`) exporting domain model types (`Trip`, `Day`, `Stop`, `Homestay`, `Message`) consumed by both client and server.

### Modified Capabilities
_(none — no existing specs have been archived to main yet)_

## Impact

- **Project structure**: Every file path from the `initial-project-scaffold` change shifts under `client/` or `server/`. The `initial-project-scaffold` tasks should be applied with the new paths.
- **Dependencies**: `client/` and `server/` each get their own `package.json`. Root `package.json` uses npm workspaces.
- **Dev workflow**: Developers run `npm install` at the root (installs both workspaces). `npm run dev` starts both client and server concurrently.
- **Shared types**: Domain model types live in `shared/types.ts` and are imported by both packages, ensuring a single source of truth.
