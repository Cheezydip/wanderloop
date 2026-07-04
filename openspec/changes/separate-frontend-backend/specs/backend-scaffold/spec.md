## ADDED Requirements

### Requirement: Express server starts and listens
The system SHALL provide an Express + TypeScript server in the `server/` workspace that listens on the port specified by the `PORT` environment variable (defaulting to `3001`).

#### Scenario: Server starts on configured port
- **WHEN** a developer runs `npm run dev` in the `server/` workspace
- **THEN** the Express server starts and logs that it is listening on the configured port

### Requirement: Health check endpoint exists
The system SHALL expose a `GET /api/health` endpoint that returns a JSON response with `{ status: "ok" }` and HTTP 200.

#### Scenario: Health check responds
- **WHEN** a client sends a GET request to `/api/health`
- **THEN** the server responds with HTTP 200 and `{ "status": "ok" }`

### Requirement: CORS is configured for dev frontend
The system SHALL configure CORS middleware to allow requests from the Vite dev server origin (`http://localhost:5173`) during development.

#### Scenario: Frontend can call backend
- **WHEN** the React client on `localhost:5173` sends an API request to the Express server on `localhost:3001`
- **THEN** the request is not blocked by CORS

### Requirement: Server uses shared types
The system SHALL import domain model types from `@wanderloop/shared` rather than defining its own copies.

#### Scenario: Server imports shared Trip type
- **WHEN** the server code imports `Trip` from `@wanderloop/shared`
- **THEN** TypeScript compiles without errors and the type matches the shared definition
