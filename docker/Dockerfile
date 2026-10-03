# Production image of the web app. Build from the repository root:
#   docker compose -f docker/compose.prod.yml --env-file .env up -d --build

# --- build: install the workspace and build the Nitro server bundle ---
FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /src
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

# --- runtime: only the self-contained .output, migrations, default hall image and ffmpeg ---
FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    MIGRATIONS_DIR=/app/migrations \
    HALL_IMAGE_PATH=/app/halle.png
COPY --from=build /src/apps/web/.output ./.output
COPY --from=build /src/apps/web/server/db/migrations ./migrations
COPY --from=build /src/reference/halle.png ./halle.png
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", ".output/server/index.mjs"]
