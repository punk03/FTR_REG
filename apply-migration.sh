#!/bin/bash
# Script to apply database migration

set -e

PROJECT_DIR="/home/fil/FTR_REG"
cd "$PROJECT_DIR/backend"

echo "[INFO] Applying database migration..."

# Generate Prisma Client
echo "[INFO] Generating Prisma Client..."
npx prisma generate

# Create and apply migration
echo "[INFO] Creating migration..."
npx prisma migrate dev --name add_manual_payments || {
  echo "[WARNING] Migration may already exist, trying to apply..."
  npx prisma migrate deploy
}

echo "[SUCCESS] Migration applied successfully!"
