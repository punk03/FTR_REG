#!/bin/bash

# Helper script to start Prisma Studio in production environment.
# It will:
# - Load DATABASE_URL from backend .env (if present) or environment.
# - Run `npx prisma studio` bound to 0.0.0.0:5555 so it is reachable as:
#   http://185.185.68.105:5555  (when port 5555 is open on the server).
#
# Usage on the server:
#   cd ~/FTR_REG/backend
#   chmod +x start_prisma_studio.sh
#   ./start_prisma_studio.sh
#
# IMPORTANT:
# - Prisma Studio is an admin tool, do NOT expose it без защиты.
# - Use the nginx config from `server/prisma-studio.nginx.conf` with basic auth.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f ".env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs)
fi

echo "Starting Prisma Studio on 0.0.0.0:5555..."
echo "DATABASE_URL=${DATABASE_URL:-not set}"

npx prisma studio --port 5555 --hostname 0.0.0.0


