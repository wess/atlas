FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock* ./
COPY atlas/ ./atlas/
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/atlas ./atlas
COPY package.json bun.lock* ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY app.ts edge.ts ./

# 80 + 443 for the edge; 3000 for the app. compose.yaml selects the entry
# point per service, so only one of these is exposed per container.
EXPOSE 80 443 3000

CMD ["bun", "run", "app.ts"]
