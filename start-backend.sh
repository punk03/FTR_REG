#!/bin/bash

# Script to start backend

set -e

PROJECT_DIR="/home/fil/FTR_REG"
cd "$PROJECT_DIR"

echo "[INFO] Starting backend..."

# Check if already running
if pgrep -f "node.*dist/index.js" > /dev/null; then
  echo "[WARNING] Backend is already running. Stopping it first..."
  pkill -f "node.*dist/index.js"
  sleep 2
fi

# Check if dist exists
if [ ! -d backend/dist ] || [ ! -f backend/dist/index.js ]; then
  echo "[INFO] Backend not built. Building..."
  cd backend
  npm run build
  cd ..
fi

# Start backend
cd backend
echo "[INFO] Starting backend process..."
nohup npm start > ../backend.log 2>&1 &
echo $! > ../backend.pid

echo "[INFO] Waiting for backend to start..."
sleep 3

# Check if started
if pgrep -f "node.*dist/index.js" > /dev/null; then
  echo "[SUCCESS] Backend started successfully"
  echo "[INFO] PID: $(cat ../backend.pid)"
  echo "[INFO] Logs: tail -f ../backend.log"
else
  echo "[ERROR] Backend failed to start"
  echo "[INFO] Check logs: tail -20 ../backend.log"
  exit 1
fi

# Test connection
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "[SUCCESS] Backend is responding"
else
  echo "[WARNING] Backend may not be fully ready yet"
fi

