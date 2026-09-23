# syntax=docker/dockerfile:1

# ---- build: install all deps, generate the Prisma client, compile TypeScript ----
FROM node:24-alpine AS build
WORKDIR /app

# Schema and config first: npm ci runs `prisma generate` as a postinstall step.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- runtime: production deps + compiled output only ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Keeps the Prisma CLI (a runtime dependency, for `migrate deploy`); drops tsx, vitest, types.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER node
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" > /dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
