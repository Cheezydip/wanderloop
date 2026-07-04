## ADDED Requirements

### Requirement: Shared package exports domain types
The system SHALL provide a `@wanderloop/shared` workspace package that exports TypeScript interfaces for `Trip`, `Day`, `Stop`, `Homestay`, and `Message`.

#### Scenario: Client imports shared types
- **WHEN** the client code imports `{ Trip, Day, Stop }` from `@wanderloop/shared`
- **THEN** TypeScript compiles without errors and the types are identical to those used by the server

#### Scenario: Server imports shared types
- **WHEN** the server code imports `{ Trip, Message }` from `@wanderloop/shared`
- **THEN** TypeScript compiles without errors and the types are identical to those used by the client

### Requirement: Shared types are the single source of truth
The system SHALL NOT define duplicate `Trip`, `Day`, `Stop`, `Homestay`, or `Message` types in either the client or server packages. All MUST import from `@wanderloop/shared`.

#### Scenario: No duplicate type definitions
- **WHEN** a developer searches for `interface Trip` across the codebase
- **THEN** it exists only in `shared/src/types.ts` and nowhere else

### Requirement: Shared package compiles via TypeScript project references
The system SHALL use TypeScript project references (`composite: true`) in `shared/tsconfig.json` so that consuming packages resolve types at compile time without a separate build step.

#### Scenario: No manual build step needed
- **WHEN** a developer runs `npm run dev` in either client or server
- **THEN** shared types resolve correctly without first running a build command in the shared package
