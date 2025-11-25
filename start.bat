@echo off
echo Starting FTR Registration System...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker first.
    exit /b 1
)

REM Start Docker services
echo Starting Docker services (PostgreSQL and Redis)...
docker-compose up -d

REM Wait for PostgreSQL to be ready
echo Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

REM Check if backend dependencies are installed
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

REM Check if frontend dependencies are installed
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

REM Run Prisma migrations
echo Running database migrations...
cd backend
call npx prisma migrate dev --name init
call npx prisma db seed
cd ..

echo Setup complete!
echo.
echo To start development servers:
echo   npm run dev
echo.
echo Backend will be available at: http://localhost:3001
echo Frontend will be available at: http://localhost:5173

pause


