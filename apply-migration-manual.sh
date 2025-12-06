#!/bin/bash
# Script to manually apply database migration

set -e

PROJECT_DIR="/home/fil/FTR_REG"
cd "$PROJECT_DIR"

echo "[INFO] Applying manual database migration..."

# Check if PostgreSQL is accessible
if ! psql -h localhost -U ftr_user -d ftr_db -c "SELECT 1;" > /dev/null 2>&1; then
  echo "[ERROR] Cannot connect to PostgreSQL database directly"
  echo "[INFO] Trying with docker exec..."
  
  # Try docker exec if running in docker
  if docker ps | grep -q postgres; then
    CONTAINER=$(docker ps | grep postgres | awk '{print $1}')
    echo "[INFO] Found PostgreSQL container: $CONTAINER"
    
    # Copy SQL file to container
    docker cp migration-add-eventId.sql $CONTAINER:/tmp/migration.sql
    
    # Execute migration with correct user
    docker exec -i $CONTAINER psql -U ftr_user -d ftr_db < migration-add-eventId.sql
    
    echo "[SUCCESS] Migration applied via Docker"
  else
    echo "[ERROR] PostgreSQL not accessible and no Docker container found"
    exit 1
  fi
else
  # Apply migration directly
  echo "[INFO] Applying migration directly..."
  psql -h localhost -U ftr_user -d ftr_db -f migration-add-eventId.sql
  
  echo "[SUCCESS] Migration applied directly"
fi

# Regenerate Prisma Client
echo "[INFO] Regenerating Prisma Client..."
cd backend
npx prisma generate

echo "[SUCCESS] Migration complete! Please restart backend."

