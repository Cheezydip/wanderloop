## Context

Wanderloop's `initial-project-scaffold` change planned a single Vite project with all code under `src/`. The architecture docs (`ARCHITECTURE.md`) already describe a clear client-server boundary: the frontend is a React SPA and the backend is a Node/Express or Python/FastAPI server hosting the Claude AI tool-calling loop. Since the repo is still pre-code, restructuring now costs nothing. Doing it later — after components, routes, and imports are wired — would require a disruptive migration.

## Goals / Non-Goals

**Goals:**
- A monorepo with `client/`, `server/`, and `shared/` as npm workspaces.
- `client/` contains the full Vite + React + TypeScript + Tailwind frontend (everything from the `initial-project-scaffold` change).
- `server/` contains a minimal Express + TypeScript backend with a health endpoint, CORS, and dotenv, ready for the Claude AI loop in Phase 2.
- `shared/` exports the TypeScript domain model types (`Trip`, `Day`, `Stop`, `Homestay`, `Message`) so both sides use one source of truth.
- A root-level `npm run dev` that starts both client and server concurrently.

**Non-Goals:**
- No API routes beyond `/api/health` — real endpoints come in Phase 2.
- No database or ORM setup — that's Phase 7.
- No Docker or production deployment config.
- Not switching to a different monorepo tool (Turborepo, Nx, Lerna) — plain npm workspaces are sufficient.

## Decisions

### 1. npm workspaces over Turborepo/Nx
**Choice:** Native npm workspaces with a root `package.json`.
**Rationale:** The project has only two packages (client + server) and a tiny shared lib. npm workspaces handle dependency hoisting and cross-package linking natively since npm 7. Turborepo/Nx add build caching and task orchestration we don't need yet.
**Alternatives considered:** Turborepo (overkill for 2 packages), Yarn workspaces (npm is already the package manager), pnpm workspaces (viable but switching package managers mid-plan adds friction).

### 2. Express + TypeScript for the backend
**Choice:** Node.js with Express and TypeScript.
**Rationale:** The open decision in `TODO.md` was Node/Express vs Python/FastAPI. Choosing Node means both client and server share the same language (TypeScript), the same `shared/` types package, and the same tooling. This eliminates a language boundary, simplifies CI, and lets a single `tsconfig` base cover everything.
**Alternatives considered:** Python/FastAPI (better for ML-heavy work, but Wanderloop's backend is mostly API orchestration — calling Claude and lodging APIs — where Node is equally capable).

### 3. `shared/` as a workspace package (not published)
**Choice:** A `shared/` directory with its own `package.json` (`@wanderloop/shared`), referenced via workspace protocol (`"@wanderloop/shared": "workspace:*"`).
**Rationale:** This keeps domain types in one place. Both `client` and `server` import from `@wanderloop/shared`. The package is never published to npm — it's a monorepo-internal dependency.
**Alternatives considered:** Copying types into both packages (drift risk), TypeScript path aliases (works but less portable).

### 4. Concurrently for dev script
**Choice:** Use the `concurrently` npm package in the root to run `client:dev` and `server:dev` in parallel.
**Rationale:** Simple, well-known, and handles colored output per process. The root `npm run dev` command starts both.
**Alternatives considered:** `npm-run-all` (less actively maintained), separate terminal windows (worse DX).

### 5. Folder structure

```
wanderloop/
├── package.json              # Root: workspaces config + concurrently dev script
├── tsconfig.base.json        # Shared TS compiler options
├── .env.example              # All env vars (VITE_MAPBOX_TOKEN, PORT, CLAUDE_API_KEY)
├── .gitignore
│
├── client/                   # Frontend workspace
│   ├── package.json          # name: @wanderloop/client
│   ├── tsconfig.json         # Extends ../tsconfig.base.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── components/
│       ├── features/
│       │   ├── chat/
│       │   ├── map/
│       │   └── itinerary/
│       ├── context/
│       ├── styles/
│       ├── App.tsx
│       └── main.tsx
│
├── server/                   # Backend workspace
│   ├── package.json          # name: @wanderloop/server
│   ├── tsconfig.json         # Extends ../tsconfig.base.json
│   └── src/
│       ├── index.ts          # Express app entry
│       ├── routes/
│       │   └── health.ts
│       └── middleware/
│           └── cors.ts
│
└── shared/                   # Shared types workspace
    ├── package.json          # name: @wanderloop/shared
    ├── tsconfig.json
    └── src/
        ├── index.ts          # Re-exports all types
        └── types.ts          # Trip, Day, Stop, Homestay, Message
```

## Risks / Trade-offs

- **[npm workspace linking quirks]** → Some tools (e.g., ESLint plugins) can struggle with hoisted dependencies in workspaces. Mitigation: Pin problematic deps in the workspace that needs them; test `npm install` from a clean state.
- **[Shared package build step]** → `shared/` needs to be compiled (or use TypeScript project references) before `client` and `server` can consume it. Mitigation: Use TypeScript project references with `composite: true` so imports resolve at compile time without a separate build step.
- **[Extra complexity for a 2-person project]** → Monorepo adds folders and config. Mitigation: The structure is minimal (3 `package.json` files, 1 root tsconfig base). The benefit of clean separation outweighs the overhead.

## Open Questions

- **Backend port**: Default to `3001` for the Express server (client dev server on `5173`). The client's Vite config will proxy `/api` requests to the server. Confirm with user if different ports are preferred.
