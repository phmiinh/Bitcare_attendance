## Frontend Dockerfile - Next.js (multi-stage, standalone build)

FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Install pnpm via corepack (Node 20 has corepack)
RUN corepack enable

# Copy dependency manifests first for better caching
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build Next.js in production mode (standalone output is enabled in next.config.mjs)
RUN pnpm run build


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy only the necessary runtime files from the standalone build
# This structure matches Next.js standalone output
# Next.js standalone includes compiled server code in .next/standalone/.next/server/
# API routes in app/api/ are compiled to .next/server/app/api/
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./public/_next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]

