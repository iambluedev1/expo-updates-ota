#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --config=prisma.config.ts

echo "Starting server..."
exec "$@"
