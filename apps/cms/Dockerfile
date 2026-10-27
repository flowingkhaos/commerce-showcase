# The showcase CMS on Node 24. Built on the VM itself (arm64 there, amd64 locally).
FROM docker.io/library/node:24.22.1-bookworm-slim
COPY --from=docker.io/oven/bun:1.4.0 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# The config refuses to load without these; the build never connects to the database.
RUN PAYLOAD_SECRET=build-only DATABASE_URL=postgres://build-only@127.0.0.1:1/none \
    NEXT_TELEMETRY_DISABLED=1 node_modules/.bin/next build \
 && mkdir -p media && chown -R node:node media .next
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--no-deprecation
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--port", "3000"]
