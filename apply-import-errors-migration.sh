#!/bin/bash

# Script to apply ImportError migration
# Usage: ./apply-import-errors-migration.sh

set -e

PROJECT_DIR="/home/fil/FTR_REG"
MIGRATION_FILE="$PROJECT_DIR/backend/prisma/migrations/add_import_errors.sql"

echo "[INFO] Applying ImportError migration..."

# Create migration file if it doesn't exist
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "[INFO] Creating migration file..."
    mkdir -p "$PROJECT_DIR/backend/prisma/migrations"
    cat > "$MIGRATION_FILE" <<'EOF'
-- Migration: Add ImportError model
CREATE TABLE IF NOT EXISTS "ImportError" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rowData" TEXT NOT NULL,
    "errors" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ImportError_eventId_idx" ON "ImportError"("eventId");
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ImportError_eventId_fkey'
    ) THEN
        ALTER TABLE "ImportError" 
        ADD CONSTRAINT "ImportError_eventId_fkey" 
        FOREIGN KEY ("eventId") 
        REFERENCES "Event"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;
EOF
    echo "[SUCCESS] Migration file created"
fi

# Try to get database connection details from .env
cd "$PROJECT_DIR/backend"
if [ -f .env ]; then
    source .env
else
    echo "[ERROR] .env file not found in backend directory"
    exit 1
fi

# Extract database connection details
if [ -z "$DATABASE_URL" ]; then
    echo "[ERROR] DATABASE_URL not found in .env"
    exit 1
fi

# Parse DATABASE_URL (format: postgresql://user:password@host:port/database)
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

if [ -z "$DB_USER" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ]; then
    echo "[ERROR] Could not parse DATABASE_URL"
    exit 1
fi

echo "[INFO] Connecting to database: $DB_NAME@$DB_HOST:$DB_PORT"

# Try direct psql connection
if command -v psql &> /dev/null; then
    echo "[INFO] Using psql..."
    export PGPASSWORD="$DB_PASS"
    psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"
    unset PGPASSWORD
    echo "[SUCCESS] Migration applied successfully"
    exit 0
fi

# Try docker exec if psql is not available
if command -v docker &> /dev/null; then
    echo "[INFO] Trying docker exec..."
    # Try to find PostgreSQL container
    CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep -i postgres | head -n 1)
    if [ -n "$CONTAINER_NAME" ]; then
        echo "[INFO] Found PostgreSQL container: $CONTAINER_NAME"
        docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$MIGRATION_FILE"
        echo "[SUCCESS] Migration applied successfully via Docker"
        exit 0
    else
        echo "[WARNING] PostgreSQL container not found"
    fi
fi

echo "[ERROR] Could not apply migration. Please run manually:"
echo "psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -f $MIGRATION_FILE"
exit 1

