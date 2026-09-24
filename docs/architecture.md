# Architecture

Business rules (lifecycle, fares, matching, concurrency) live in [domain-rules.md](domain-rules.md).

## System overview

```mermaid
flowchart LR
    B[Browser<br/>passenger / driver] -->|HTTPS| W[Next.js App Router<br/>web/]
    W -->|"/api/* rewrite<br/>(same-origin cookie)"| A[Express REST API<br/>api/]
    A -->|Prisma + raw SQL locks| D[(PostgreSQL 16)]
```

| Layer | Tech | Hosting (free tier) | Local |
|---|---|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS | Vercel | `web` container |
| Backend | Node.js, Express, TypeScript, Zod, pino | Render | `api` container |
| Database | PostgreSQL 16 via Prisma | Neon | `db` container |

Deliberately **not** included: Redis, queues, microservices, WebSockets. One API process plus one
Postgres handles the MVP; Postgres row locks and constraints handle seat consistency (see
[domain-rules.md § Concurrency](domain-rules.md#concurrency-the-last-seat-problem)).

### Request flow

1. The browser only talks to Next.js. Next.js rewrites `/api/*` to the Express API
   (`http://api:4000` in Docker, the Render URL in production). The auth cookie is therefore
   first-party (`SameSite=Lax`) even though web and API are on different hosts.
2. Express authenticates the JWT from the httpOnly cookie, validates input with Zod, and calls a service.
3. Services own database transactions. Pure domain functions (fare, state machine, matching) hold the rules
   and have no database access, so they are unit-testable.
4. Status changes reach the screen by polling every ~5 s.
5. A timer inside the API process expires ride requests nobody accepted within 5 minutes
   (see [domain-rules.md § Nobody waits forever](domain-rules.md#nobody-waits-forever)).

Proxies: Express trusts exactly `TRUST_PROXY` hops of `X-Forwarded-For` when working out the visitor's address
for rate limiting. That's 2 on Vercel → Render (Vercel's edge sets the header, Render's balancer appends one
entry) and 0 under docker compose (self-hosted Next.js doesn't add the visitor, so the header can't be trusted).

### Backend layering

```
routes  →  controller  →  service  →  Prisma / raw SQL
                            │
                            └── domain/ (pure: fare.ts, rideStateMachine.ts, matching.ts)
```

- **routes**: URL, auth and role guards, Zod validation middleware.
- **controller**: maps HTTP to service calls; no business rules.
- **service**: transactions, locking, authorization on ownership, history writes.
- **domain**: pure functions, no I/O.

Cross-cutting: helmet, CORS allowlist, rate limiting on auth routes, request IDs, structured logging (pino),
central error handler, environment validation at boot, `GET /health` (checks the DB).

## Database (ERD)

```mermaid
erDiagram
    users ||--o| vehicles : "drives (DRIVER only)"
    users ||--o| wallets : "has"
    users ||--o{ ride_requests : "requests (PASSENGER)"
    users ||--o{ wallet_transactions : "owns"
    stops ||--o{ ride_requests : "pickup / drop"
    vehicles ||--o{ pools : "runs"
    pools ||--o{ pool_members : "contains"
    ride_requests ||--o| pool_members : "joins"
    ride_requests ||--o| payments : "paid by"
    ride_requests ||--o{ ride_status_history : "audited"
    pools ||--o{ ride_status_history : "audited"
    ride_requests ||--o{ wallet_transactions : "charged"

    users {
        uuid id PK
        text name
        text email UK
        text password_hash
        enum role "PASSENGER | DRIVER"
        timestamptz created_at
    }
    vehicles {
        uuid id PK
        uuid driver_id FK,UK
        text name "e.g. Bullet"
        text plate UK
        smallint capacity "CHECK 1-3, fixed"
        bool is_online
    }
    stops {
        int id PK
        text name UK
        smallint sequence UK "0 = start"
        int distance_from_start_m
        numeric lat
        numeric lng
    }
    pools {
        uuid id PK
        uuid vehicle_id FK
        enum status
        smallint capacity "copied from vehicle"
        smallint seats_occupied "CHECK 0..capacity"
        timestamptz arrived_at
        timestamptz started_at
        timestamptz completed_at
        timestamptz cancelled_at
    }
    ride_requests {
        uuid id PK
        uuid passenger_id FK
        int pickup_stop_id FK
        int drop_stop_id FK
        smallint seats "CHECK 1-3"
        enum status "REQUESTED..COMPLETED | CANCELLED | EXPIRED"
        enum payment_method "CASH | WALLET"
        int distance_m
        int est_solo_fare_poisha
        int est_pooled_fare_poisha
        int base_fare_poisha
        int distance_charge_poisha
        int pool_discount_poisha
        int final_fare_poisha
        bool pooled
        uuid cancelled_by FK
        text cancel_reason
    }
    pool_members {
        uuid id PK
        uuid pool_id FK
        uuid ride_request_id FK,UK
        smallint seats
        timestamptz joined_at
        timestamptz left_at
    }
    ride_status_history {
        uuid id PK
        uuid ride_request_id FK "nullable"
        uuid pool_id FK "nullable"
        text from_status
        text to_status
        uuid actor_user_id FK
        text reason
        timestamptz created_at
    }
    wallets {
        uuid user_id PK,FK
        int balance_poisha "CHECK >= 0"
    }
    wallet_transactions {
        uuid id PK
        uuid user_id FK
        int amount_poisha "signed"
        enum type "TOPUP | RIDE_PAYMENT"
        uuid ride_request_id FK
        int balance_after_poisha
        timestamptz created_at
    }
    payments {
        uuid id PK
        uuid ride_request_id FK,UK
        enum method
        int amount_poisha
        enum status
        timestamptz paid_at
    }
```

### Why each table exists

| Table | Purpose |
|---|---|
| `users` | Passengers and drivers share one table with a `role` enum. Both sign up. |
| `vehicles` | A driver's Tesla. One per driver (`driver_id` unique). `capacity` is 1–3 and has no update endpoint. |
| `stops` | The single predefined route line, ordered by `sequence`. Fare distance = drop's `distance_from_start_m`. |
| `pools` | One shared trip of one Tesla. Holds the pool-level state and the seat counter that enforces capacity. |
| `pool_members` | Which ride request is in which pool, with join/leave times (a cancelled rider keeps a `left_at` row). |
| `ride_requests` | A passenger's ride: trip, seats, per-passenger status, estimate, and the frozen fare breakdown. |
| `ride_status_history` | Append-only log of every transition and who caused it — answers "what happened?" later. |
| `wallets` / `wallet_transactions` | Simulated TeslaPay: balance plus an append-only ledger. |
| `payments` | One payment record per completed ride, for cash or wallet. |

### Key constraints and indexes

- `pools`: `CHECK (seats_occupied BETWEEN 0 AND capacity)`; partial unique index on `vehicle_id`
  `WHERE status IN ('MATCHED','DRIVER_ARRIVED','STARTED')` — one active pool per Tesla.
- `ride_requests`: partial unique index on `passenger_id` for active statuses — one active ride per
  passenger (also makes "request ride" safe to retry); `CHECK (pickup_stop_id <> drop_stop_id)`;
  index `(status, created_at)` for the driver feed; index `(passenger_id, created_at DESC)` for history.
- `wallets`: `CHECK (balance_poisha >= 0)`.
- Money is always `INTEGER` poisha (৳1 = 100 poisha).

## API overview (REST)

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Sign up as passenger, or as driver with `vehicle {name, plate, capacity}` |
| POST | `/api/auth/login` · `/api/auth/logout` | public | Set / clear auth cookie |
| GET | `/api/auth/me` | any | Current user |
| GET | `/api/stops` | any | The route line, in order |
| POST | `/api/fares/estimate` | passenger | Solo and pooled estimate |
| POST | `/api/rides` | passenger | Request a ride |
| GET | `/api/rides` · `/api/rides/:id` | passenger | Own history / one ride (own fare only; co-riders as a count) |
| POST | `/api/rides/:id/cancel` | passenger | Cancel own ride before STARTED |
| GET | `/api/wallet` · POST `/api/wallet/topup` | passenger | Simulated TeslaPay |
| PATCH | `/api/driver/status` | driver | Go online / offline |
| GET | `/api/driver/requests` | driver | Open requests that fit the remaining seats |
| POST | `/api/driver/requests/:id/accept` | driver | Accept into current pool (creates one if none) |
| GET | `/api/driver/pool` | driver | Current pool: members, seats, status |
| POST | `/api/pools/:id/arrive` · `start` · `complete` · `cancel` | driver | Pool lifecycle |
| GET | `/api/driver/history` | driver | Past pools |
| GET | `/health` | public | Liveness + DB check |

Errors: `{ "error": { "code", "message", "details" } }`: 400 validation, 401 unauthenticated,
403 wrong role, 404 not found **or not yours**, 409 invalid transition / capacity / no Tesla available /
insufficient balance / conflict, 429 rate limited.

**Why REST:** the app is a small set of resources (rides, pools, wallet) with clear state-changing actions.
REST maps onto that directly, is trivial to test with Supertest, and needs no extra schema tooling.
GraphQL would pay off with many clients needing different shapes of the same data, which this MVP doesn't have.
