# Separation Creek Krillion — single container: web client + game server
#
#   docker build -t krillion .
#   docker run -p 8787:8787 krillion
#
# Set DATABASE_URL to persist games (migrations run automatically on start).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8787
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/shared ./shared
COPY --from=build /app/server/data ./server/data
COPY --from=build /app/server/db/migrations ./server/db/migrations
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz > /dev/null || exit 1
USER node
CMD ["node", "dist/server/server/index.js"]
