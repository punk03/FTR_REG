#!/bin/bash

# Quick fix script for import errors functionality
# Usage: ./fix-import-errors-now.sh

set -e

PROJECT_DIR="/home/fil/FTR_REG"
cd "$PROJECT_DIR"

echo "=========================================="
echo "Fixing Import Errors functionality"
echo "=========================================="

# Step 1: Stop all backend processes
echo "[1/5] Stopping all backend processes..."
pkill -9 -f "node.*dist/index.js" 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 3

# Step 2: Pull latest code
echo "[2/5] Pulling latest code..."
git pull origin main || echo "[WARNING] Git pull failed"

# Step 3: Create migration file if missing
echo "[3/5] Ensuring migration file exists..."
mkdir -p "$PROJECT_DIR/backend/prisma/migrations"
if [ ! -f "$PROJECT_DIR/backend/prisma/migrations/add_import_errors.sql" ]; then
    cat > "$PROJECT_DIR/backend/prisma/migrations/add_import_errors.sql" <<'EOF'
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

# Step 4: Apply migration
echo "[4/5] Applying database migration..."
cd "$PROJECT_DIR/backend"
if [ -f .env ]; then
    source .env
    if [ -n "$DATABASE_URL" ]; then
        # Check if table exists
        TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ImportError');" 2>/dev/null || echo "f")
        if [ "$TABLE_EXISTS" = "f" ]; then
            echo "[INFO] Creating ImportError table..."
            psql "$DATABASE_URL" -f "$PROJECT_DIR/backend/prisma/migrations/add_import_errors.sql" || {
                echo "[WARNING] Migration failed, trying direct SQL..."
                psql "$DATABASE_URL" <<'SQL'
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
SQL
            }
            echo "[SUCCESS] Migration applied"
        else
            echo "[SUCCESS] ImportError table already exists"
        fi
    else
        echo "[WARNING] DATABASE_URL not found in .env"
    fi
else
    echo "[WARNING] .env file not found"
fi

# Step 5: Rebuild and start backend
echo "[5/5] Rebuilding and starting backend..."
cd "$PROJECT_DIR/backend"
npm run build || {
    echo "[ERROR] Build failed!"
    exit 1
}

# Ensure port is free
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 2

# Start backend
nohup node dist/index.js > backend.log 2>&1 &
BACKEND_PID=$!

sleep 5

# Verify backend started
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo ""
    echo "=========================================="
    echo "[SUCCESS] Backend started (PID: $BACKEND_PID)"
    echo "=========================================="
    echo ""
    echo "Backend logs: tail -f $PROJECT_DIR/backend/backend.log"
    echo ""
    echo "Test the route:"
    echo "  curl http://localhost:3001/api/events/1/import-errors"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "[ERROR] Backend failed to start"
    echo "=========================================="
    echo ""
    echo "Check logs:"
    tail -30 "$PROJECT_DIR/backend/backend.log"
    exit 1
fi

