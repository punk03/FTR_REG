#!/bin/bash

# Script to check frontend deployment

echo "=== Frontend Deployment Check ==="
echo ""

cd "$(dirname "$0")/frontend" || exit 1

echo "1. Checking if dist directory exists..."
if [ ! -d "dist" ]; then
    echo "ERROR: dist directory not found! Run 'npm run build' first."
    exit 1
fi
echo "OK: dist directory exists"
echo ""

echo "2. Checking dist/index.html..."
if [ ! -f "dist/index.html" ]; then
    echo "ERROR: dist/index.html not found!"
    exit 1
fi
echo "OK: dist/index.html exists"
echo ""

echo "3. Checking for JS files in dist..."
JS_FILES=$(find dist -name "*.js" | head -5)
if [ -z "$JS_FILES" ]; then
    echo "ERROR: No JS files found in dist!"
    exit 1
fi
echo "OK: JS files found:"
echo "$JS_FILES" | head -3
echo ""

echo "4. Checking index.html content..."
if grep -q "/src/main.tsx" dist/index.html; then
    echo "ERROR: index.html still references /src/main.tsx (not built correctly)"
    echo "Content:"
    grep "src=" dist/index.html
    exit 1
fi
echo "OK: index.html references built files"
echo ""

echo "5. Checking if serve is running..."
if pgrep -f "serve.*dist" > /dev/null; then
    SERVE_PID=$(pgrep -f "serve.*dist" | head -1)
    echo "OK: serve is running (PID: $SERVE_PID)"
else
    echo "WARNING: serve is not running"
fi
echo ""

echo "6. Testing HTTP response..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "OK: Frontend responds on port 3000"
    echo ""
    echo "First 500 chars of response:"
    curl -s http://localhost:3000 | head -c 500
    echo ""
else
    echo "ERROR: Frontend does not respond on port 3000"
fi
echo ""

echo "=== Check Complete ==="

