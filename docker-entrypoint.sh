#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data

# Run migrations if database doesn't exist or needs updating
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application
exec node build
