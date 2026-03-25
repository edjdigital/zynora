# syntax=docker/dockerfile:1

# Build VitePress static site (runs icon data + vitepress build)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock* ./

RUN if [ -f yarn.lock ]; then \
        yarn install --frozen-lockfile; \
    else \
        yarn install; \
    fi

COPY . .

# Skip git-based `lastUpdated` (see docs/.vitepress/config.mts)
ENV ZYNORA_DOCS_NO_GIT=1

RUN yarn doc:build

# Serve static output
FROM nginx:alpine AS runtime

RUN apk add --no-cache wget

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
