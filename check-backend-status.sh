#!/bin/bash

# Script to check backend status

PROJECT_DIR="/home/fil/FTR_REG"
cd "$PROJECT_DIR"

echo "=== Backend Status Check ==="
echo ""

echo "1. Checking if backend process is running:"
if pgrep -f "node.*dist/index.js" > /dev/null; then
  echo "✅ Backend process found:"
  ps aux | grep "node.*dist/index.js" | grep -v grep
else
  echo "❌ Backend process NOT running"
fi

echo ""
echo "2. Checking if port 3001 is listening:"
if ss -tlnp | grep -q ":3001"; then
  echo "✅ Port 3001 is listening:"
  ss -tlnp | grep ":3001"
else
  echo "❌ Port 3001 is NOT listening"
fi

echo ""
echo "3. Checking backend logs (last 20 lines):"
if [ -f backend.log ]; then
  echo "--- Last 20 lines of backend.log ---"
  tail -20 backend.log
else
  echo "⚠️  backend.log not found"
fi

echo ""
echo "4. Testing backend connection:"
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "✅ Backend responds to /api/health"
  curl -s http://localhost:3001/api/health | head -5
else
  echo "❌ Backend does NOT respond to /api/health"
fi

echo ""
echo "5. Checking backend build:"
if [ -d backend/dist ]; then
  echo "✅ Backend dist directory exists"
  if [ -f backend/dist/index.js ]; then
    echo "✅ Backend index.js exists"
  else
    echo "❌ Backend index.js NOT found"
  fi
else
  echo "❌ Backend dist directory NOT found - needs rebuild"
fi

