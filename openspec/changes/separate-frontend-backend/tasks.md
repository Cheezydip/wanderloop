## 1. Root Monorepo Setup

- [ ] 1.1 Create root `package.json` with `name: "wanderloop"`, `private: true`, and `workspaces: ["client", "server", "shared"]`
- [ ] 1.2 Create `tsconfig.base.json` at root with shared compiler options (`strict`, `esModuleInterop`, `target: ES2022`, `moduleResolution: bundler`)
- [ ] 1.3 Create `.env.example` with `VITE_MAPBOX_TOKEN=`, `PORT=3001`, `CLAUDE_API_KEY=`
- [ ] 1.4 Update `.gitignore` to include `.env`, `node_modules/`, `dist/` for all workspaces
- [ ] 1.5 Install `concurrently` as a root dev dependency
- [ ] 1.6 Add root `dev` script: `concurrently "npm run dev -w client" "npm run dev -w server"` with labeled colored output

## 2. Shared Types Package

- [ ] 2.1 Create `shared/package.json` with `name: "@wanderloop/shared"`, `main: "src/index.ts"`, `types: "src/index.ts"`
- [ ] 2.2 Create `shared/tsconfig.json` extending `../tsconfig.base.json` with `composite: true` and `rootDir: "src"`, `outDir: "dist"`
- [ ] 2.3 Create `shared/src/types.ts` with TypeScript interfaces: `Trip`, `Day`, `Stop`, `Homestay`, `Message` (moved from the initial-project-scaffold's planned `src/models/types.ts`)
- [ ] 2.4 Create `shared/src/index.ts` re-exporting all types from `types.ts`

## 3. Client Workspace (Frontend)

- [ ] 3.1 Scaffold Vite + React + TypeScript project inside `client/` directory
- [ ] 3.2 Set `client/package.json` name to `@wanderloop/client` and add dependency `"@wanderloop/shared": "workspace:*"`
- [ ] 3.3 Create `client/tsconfig.json` extending `../tsconfig.base.json` with TypeScript project reference to `../shared`
- [ ] 3.4 Install frontend dependencies in `client/`: `react`, `react-dom`, `mapbox-gl`, `tailwindcss`, `@tailwindcss/vite`
- [ ] 3.5 Install frontend dev dependencies: `@types/react`, `@types/react-dom`, `eslint`, `prettier`
- [ ] 3.6 Configure `client/vite.config.ts` with Tailwind plugin and API proxy (`/api` → `http://localhost:3001`)
- [ ] 3.7 Move all frontend source code structure under `client/src/` (components, features, context, styles, App.tsx, main.tsx)
- [ ] 3.8 Update domain model imports in `client/` to use `import { Trip, Day, Stop } from '@wanderloop/shared'` instead of local types
- [ ] 3.9 Configure ESLint and Prettier in `client/`
- [ ] 3.10 Add `client/` scripts: `dev`, `build`, `lint`, `format`

## 4. Server Workspace (Backend)

- [ ] 4.1 Create `server/package.json` with `name: "@wanderloop/server"` and dependency `"@wanderloop/shared": "workspace:*"`
- [ ] 4.2 Create `server/tsconfig.json` extending `../tsconfig.base.json` with TypeScript project reference to `../shared`
- [ ] 4.3 Install server dependencies: `express`, `cors`, `dotenv`
- [ ] 4.4 Install server dev dependencies: `@types/express`, `@types/cors`, `tsx` (for dev runner), `typescript`
- [ ] 4.5 Create `server/src/index.ts`: Express app entry that loads dotenv, applies CORS middleware, registers routes, and listens on `PORT` (default `3001`)
- [ ] 4.6 Create `server/src/routes/health.ts`: `GET /api/health` returning `{ status: "ok" }`
- [ ] 4.7 Create `server/src/middleware/cors.ts`: CORS config allowing `http://localhost:5173` in development
- [ ] 4.8 Add `server/` scripts: `dev` (using `tsx watch src/index.ts`), `build`, `start`

## 5. Integration & Verification

- [ ] 5.1 Run `npm install` at the root and verify all three workspaces link correctly (no missing peer deps)
- [ ] 5.2 Verify `shared/` types compile: import `Trip` from `@wanderloop/shared` in both client and server without errors
- [ ] 5.3 Run `npm run dev` at root and verify both Vite client (port 5173) and Express server (port 3001) start
- [ ] 5.4 Verify `GET http://localhost:3001/api/health` returns `{ "status": "ok" }`
- [ ] 5.5 Verify the Vite proxy: `GET http://localhost:5173/api/health` is proxied to the Express server and returns `{ "status": "ok" }`
- [ ] 5.6 Run `npm run lint -w client` and confirm no errors
