FROM node:22-alpine as base

# Generate a partial monorepo for a target package. The output will be placed into a directory named "out"
FROM base AS prune
RUN apk update
RUN apk add --no-cache libc6-compat

WORKDIR /app
RUN npm install turbo --global
COPY . .
RUN turbo prune server --docker

# This Step only installs Production & Dev dependencies
FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
# the /out/json contain the package.json file that is used to install packages related to the "server"
COPY --from=prune /app/out/json/ .

RUN npm install

# This Step only installs Production dependencies only
FROM base AS installer-production
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
# the /out/json contain the package.json file that is used to install packages related to the "server"
COPY --from=prune /app/out/json/ .

RUN npm install --only=production

# Uses the dev & production dependencies to make a production build
FROM base AS builder
WORKDIR /app
COPY --from=installer /app/node_modules /app/node_modules

# the /out/full contain the code files that is used to run the package "server"
COPY --from=prune /app/out/full/ .

# Force Prisma to generate for the correct platform
RUN cd apps/server && npx prisma generate

RUN npx turbo build --filter=server --force

# runner will use the builder output, and use only the node_modules for production to reduce the size of the final image
FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 server-group
RUN adduser --system --uid 1001 server-user

# Copy Production dependencies, build and prisma directories
COPY --from=installer-production --chown=server-user:server-group /app/ .
COPY --from=builder --chown=server-user:server-group /app/apps/server/dist /app/apps/server/dist
COPY --from=builder --chown=server-user:server-group /app/apps/server/prisma /app/apps/server/prisma
COPY --from=builder --chown=server-user:server-group /app/apps/server/prisma.config.ts /app/apps/server/prisma.config.ts

# Copy entrypoint script
COPY apps/server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create uploads directory
RUN mkdir -p /app/apps/server/uploads && chown -R server-user:server-group /app/apps/server/uploads

USER server-user

WORKDIR /app/apps/server

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
