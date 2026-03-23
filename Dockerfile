# ===================================
# Stage 1: Dependencies
# ===================================
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_modules && \
    npm ci

# ===================================
# Stage 2: Build
# ===================================
FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ===================================
# Stage 3: Production
# ===================================
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy production dependencies for native modules (better-sqlite3)
COPY --from=deps /prod_modules/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps /prod_modules/node_modules/bindings ./node_modules/bindings
COPY --from=deps /prod_modules/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=deps /prod_modules/node_modules/prebuild-install ./node_modules/prebuild-install
COPY --from=deps /prod_modules/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=deps /prod_modules/node_modules/@mapbox ./node_modules/@mapbox
COPY --from=deps /prod_modules/node_modules/napi-build-utils ./node_modules/napi-build-utils
COPY --from=deps /prod_modules/node_modules/node-gyp ./node_modules/node-gyp
COPY --from=deps /prod_modules/node_modules/nopt ./node_modules/nopt
COPY --from=deps /prod_modules/node_modules/semver ./node_modules/semver

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
