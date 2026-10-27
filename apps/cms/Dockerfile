# The showcase CMS on Node 24, as Next's self-contained server (small image, fast start).
FROM docker.io/library/node:24.22.1-bookworm-slim AS build
COPY --from=docker.io/oven/bun:1.4.0 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# The config refuses to load without these; the build never connects to the database.
RUN PAYLOAD_SECRET=build-only DATABASE_URL=postgres://build-only@127.0.0.1:1/none \
    NEXT_TELEMETRY_DISABLED=1 node_modules/.bin/next build

FROM docker.io/library/node:24.22.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--no-deprecation \
    HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
RUN mkdir -p media && chown node:node media
USER node
EXPOSE 3000
CMD ["node", "server.js"]
