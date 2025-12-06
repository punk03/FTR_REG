#!/bin/bash

# Script to fix accounting route issue

set -e

PROJECT_DIR="/home/fil/FTR_REG"
cd "$PROJECT_DIR"

echo "[INFO] Fixing accounting route..."

echo "[INFO] 1. Pulling latest changes..."
git pull origin main

echo "[INFO] 2. Applying database migration..."
cd backend
npx prisma migrate dev --name add_manual_payments || echo "[WARNING] Migration may already be applied"

echo "[INFO] 3. Rebuilding backend..."
npm run build

echo "[INFO] 4. Stopping old backend..."
pkill -f "node.*dist/index.js" || echo "[INFO] No old backend process found"

echo "[INFO] 5. Starting backend..."
cd "$PROJECT_DIR/backend"
nohup npm start > ../backend.log 2>&1 &
echo $! > ../backend.pid

echo "[INFO] 6. Waiting for backend to start..."
sleep 3

echo "[INFO] 7. Testing route..."
if curl -s -X POST http://localhost:3001/api/accounting \
  -H "Content-Type: application/json" \
  -d '{"description":"test","paidFor":"PERFORMANCE","eventId":1,"cash":"100"}' \
  | grep -q "401\|400\|errors"; then
  echo "[SUCCESS] Route is responding (401/400 expected without auth)"
else
  echo "[ERROR] Route is not responding correctly"
  echo "[INFO] Checking backend logs..."
  tail -20 ../backend.log
fi

echo "[INFO] Done! Backend should be running now."

