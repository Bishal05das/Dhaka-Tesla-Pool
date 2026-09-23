# Dhaka Tesla Pool

> Share a seat. Split the fare. Survive Dhaka traffic.

A ride-pooling MVP for Dhaka's three-wheeled "Teslas". Passengers (Nusrat, Rafiq, Shirin) request rides
along a fixed route; a driver (Jashim, with his 3-seat Tesla "Bullet") accepts them into a shared pool,
and each passenger pays an individual, pooled fare.

_This README is a work in progress and will be completed during the pre-release phase._

## Quick start (Docker)

```bash
docker compose up --build
```

No `.env` is required: every setting has a default. Copy `.env.example` to `.env` to change ports or
credentials. On startup the API applies migrations and seeds the route stops and story cast.

| Service | URL |
|---|---|
| API | http://localhost:4000 (health: `/health`) |
| Postgres | `localhost:5440` (user/password/db: `tesla` / `tesla` / `dhaka_tesla`) |

Reset all data: `docker compose down -v`.

## Local development (API)

Requires Node 24 (`nvm use`) and npm 11.

```bash
docker compose up -d db          # Postgres only
cd api
cp .env.example .env
npm install
npm run db:migrate               # apply migrations
npm run db:seed                  # seed stops + cast
npm run dev                      # http://localhost:4000
npm test
```

## Contents (planned)

- Summary, problem statement, features, screenshots
- Architecture diagram and ERD → see [docs/architecture.md](docs/architecture.md)
- Tech stack and justification
- Project structure and prerequisites
- Environment variables
- Local setup, Docker, migrations and seed
- Running frontend, backend and tests; demo credentials
- Deployment URL, API overview
- Key decisions, trade-offs, known limitations, next improvements
- Concurrency handling
- AI usage
- Demo video
- Bonus: scaling to 1M passengers
