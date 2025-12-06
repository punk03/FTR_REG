#!/bin/bash

# Test script to check if POST /api/accounting route exists

echo "Testing POST /api/accounting route..."
echo ""

# Test with curl
echo "1. Testing route with curl (should return 401 without auth):"
curl -X POST http://95.71.125.8:3001/api/accounting \
  -H "Content-Type: application/json" \
  -d '{"description":"test","paidFor":"PERFORMANCE","eventId":1,"cash":"100"}' \
  -v 2>&1 | grep -E "(HTTP|404|401|400)"

echo ""
echo "2. Checking if route is registered in backend code:"
if grep -q "router.post.*'/'" backend/src/routes/accounting.ts; then
  echo "✅ POST route found in accounting.ts"
else
  echo "❌ POST route NOT found in accounting.ts"
fi

echo ""
echo "3. Checking if accounting routes are imported in index.ts:"
if grep -q "accountingRoutes" backend/src/index.ts; then
  echo "✅ accountingRoutes imported in index.ts"
else
  echo "❌ accountingRoutes NOT imported in index.ts"
fi

echo ""
echo "4. Checking route registration:"
if grep -q "app.use('/api/accounting'" backend/src/index.ts; then
  echo "✅ Route registered in index.ts"
else
  echo "❌ Route NOT registered in index.ts"
fi

