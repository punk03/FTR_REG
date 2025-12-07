#!/bin/bash

# Script to restart backend with import errors support
# Usage: ./restart-backend-with-import-errors.sh

set -e

PROJECT_DIR="/home/fil/FTR_REG"
cd "$PROJECT_DIR"

echo "[INFO] Restarting backend with import errors support..."

# Check if backend process is running
BACKEND_PIDS=$(pgrep -f "node.*dist/index.js" || echo "")

if [ -n "$BACKEND_PIDS" ]; then
    echo "[INFO] Stopping existing backend processes..."
    echo "$BACKEND_PIDS" | while read pid; do
        if [ -n "$pid" ]; then
            echo "[INFO] Killing process $pid..."
            kill "$pid" 2>/dev/null || true
        fi
    done
    sleep 3
    # Force kill if still running
    pkill -9 -f "node.*dist/index.js" 2>/dev/null || true
    sleep 2
fi

# Pull latest code
echo "[INFO] Pulling latest code..."
cd "$PROJECT_DIR"
git pull origin main || echo "[WARNING] Git pull failed, continuing..."

# Apply migration if needed
echo "[INFO] Checking if ImportError table exists..."
cd "$PROJECT_DIR/backend"
if [ -f .env ]; then
    source .env
    if [ -n "$DATABASE_URL" ]; then
        # Check if table exists
        TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ImportError');" 2>/dev/null || echo "f")
        if [ "$TABLE_EXISTS" = "f" ]; then
            echo "[INFO] ImportError table does not exist. Creating table..."
            # Create table directly
            psql "$DATABASE_URL" <<EOF || echo "[WARNING] Migration failed, continuing..."
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
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EOF
            echo "[SUCCESS] ImportError table created"
        else
            echo "[SUCCESS] ImportError table exists"
        fi
    fi
fi

# Rebuild backend
echo "[INFO] Rebuilding backend..."
cd "$PROJECT_DIR/backend"
npm run build || {
    echo "[ERROR] Build failed!"
    exit 1
}

# Start backend
echo "[INFO] Starting backend..."
cd "$PROJECT_DIR/backend"
nohup node dist/index.js > backend.log 2>&1 &
BACKEND_PID=$!

sleep 3

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null; then
    echo "[SUCCESS] Backend started successfully (PID: $BACKEND_PID)"
    echo "[INFO] Backend logs: tail -f $PROJECT_DIR/backend/backend.log"
else
    echo "[ERROR] Backend failed to start. Check logs: $PROJECT_DIR/backend/backend.log"
    exit 1
fi

# Test the route
echo "[INFO] Testing import-errors route..."
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/events/1/import-errors -H "Authorization: Bearer test" || echo ""
echo ""

echo "[INFO] Backend restart complete!"

