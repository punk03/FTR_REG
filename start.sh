#!/bin/bash

echo "Starting FTR Registration System..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Start Docker services
echo "Starting Docker services (PostgreSQL and Redis)..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Run Prisma migrations
echo "Running database migrations..."
cd backend
npx prisma migrate dev --name init || echo "Migrations may already be applied"
npx prisma db seed || echo "Seed may have already been run"
cd ..

echo "Setup complete!"
echo ""
echo "To start development servers:"
echo "  npm run dev"
echo ""
echo "Backend will be available at: http://localhost:3001"
echo "Frontend will be available at: http://localhost:5173"


