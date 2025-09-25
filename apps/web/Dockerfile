FROM node:22-alpine AS base
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/web
RUN npm run build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/dist ./dist
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN npm install -g serve
RUN chmod +x /docker-entrypoint.sh


EXPOSE 8080
CMD ["/docker-entrypoint.sh"]