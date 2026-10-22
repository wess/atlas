FROM oven/bun:1.4.4-alpine AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production --omit=peer

FROM oven/bun:1.4.4-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV EDGE_HTTP_PORT=8080 EDGE_HTTPS_PORT=8443
RUN mkdir -p /var/atlas/edge && chown bun:bun /var/atlas/edge

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY app.ts edge.ts ./

# 8080 + 8443 for the edge; 3000 for the app. compose.yaml selects the entry
# point per service, so only one of these is exposed per container.
USER bun
EXPOSE 8080 8443 3000

CMD ["bun", "run", "app.ts"]
