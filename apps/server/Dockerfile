FROM node:22-bookworm-slim

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/server apps/server
COPY packages/shared packages/shared

RUN pnpm --filter @codex-transit/server prisma:generate

EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @codex-transit/server exec prisma migrate deploy && pnpm --filter @codex-transit/server exec tsx src/index.ts"]
