FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock ./
COPY services/proxy/package.json ./services/proxy/
RUN cd services/proxy && bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/services/proxy/node_modules ./services/proxy/node_modules
COPY services/proxy ./services/proxy

# Run
FROM base AS release
COPY --from=build /app/services/proxy ./services/proxy
COPY --from=install /app/services/proxy/node_modules ./services/proxy/node_modules

WORKDIR /app/services/proxy
EXPOSE 8090

CMD ["bun", "run", "src/server.ts"]
