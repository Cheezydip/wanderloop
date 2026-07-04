## ADDED Requirements

### Requirement: Root package.json configures npm workspaces
The system SHALL have a root `package.json` with a `workspaces` field listing `client`, `server`, and `shared` directories.

#### Scenario: Workspace packages are linked
- **WHEN** a developer runs `npm install` at the project root
- **THEN** all three workspace packages (`@wanderloop/client`, `@wanderloop/server`, `@wanderloop/shared`) are installed and cross-linked

### Requirement: Shared tsconfig base exists
The system SHALL provide a `tsconfig.base.json` at the project root with shared TypeScript compiler options that all workspace packages extend.

#### Scenario: Workspace tsconfigs extend base
- **WHEN** a workspace `tsconfig.json` uses `"extends": "../tsconfig.base.json"`
- **THEN** it inherits strict mode, ES module settings, and path resolution from the base config

### Requirement: Root dev script starts both client and server
The system SHALL provide a root `npm run dev` script that starts the client dev server and the backend server concurrently using the `concurrently` package.

#### Scenario: Concurrent startup
- **WHEN** a developer runs `npm run dev` at the project root
- **THEN** both the Vite dev server (client) and Express server (server) start, with labeled colored output for each

### Requirement: Environment variables are centralized
The system SHALL use a single `.env` file at the project root (gitignored) and a `.env.example` file documenting all required variables: `VITE_MAPBOX_TOKEN`, `PORT`, `CLAUDE_API_KEY`.

#### Scenario: Env example documents all vars
- **WHEN** a developer reads `.env.example`
- **THEN** they see all required environment variables with descriptions

### Requirement: Client and server have independent dependencies
Each workspace package SHALL have its own `package.json` with only the dependencies it needs, avoiding dependency leakage between client and server.

#### Scenario: Client dependencies are isolated
- **WHEN** a developer inspects `client/package.json`
- **THEN** it contains only frontend dependencies (react, mapbox-gl, tailwindcss) and not backend dependencies (express, cors)
