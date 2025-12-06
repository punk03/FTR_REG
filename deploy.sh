#!/bin/bash

# FTR Registration System - Deployment Script for Ubuntu 24
# Автоматическое развертывание и обновление проекта

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ftr-registration-system"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then 
        print_error "Please do not run this script as root. Run as regular user with sudo privileges."
        exit 1
    fi
}

# Get current user (works with sudo -u and root)
get_current_user() {
    if [ -n "$APP_USER" ]; then
        echo "$APP_USER"
    elif [ -n "$SUDO_USER" ]; then
        echo "$SUDO_USER"
    elif [ "$EUID" -eq 0 ]; then
        # Running as root, try to find appropriate user
        if [ -n "$APP_USER" ]; then
            echo "$APP_USER"
        else
            # Try to get owner of current directory
            stat -c '%U' . 2>/dev/null || echo "root"
        fi
    elif [ -n "$USER" ]; then
        echo "$USER"
    else
        # Fallback: try to get user from whoami
        whoami 2>/dev/null || echo "unknown"
    fi
}

# Check directory permissions before starting
check_permissions() {
    print_info "Checking directory permissions..."
    
    CURRENT_USER=$(get_current_user)
    
    # Check backend directory
    if [ ! -d "backend" ]; then
        print_error "Backend directory does not exist!"
        exit 1
    fi
    
    if [ ! -w "backend" ]; then
        print_error "Backend directory is not writable by user '$CURRENT_USER'"
        print_info "Please run the following command to fix permissions:"
        print_info "  sudo chown -R $CURRENT_USER:$CURRENT_USER backend"
        print_info "Or if you have sudo access without password:"
        print_info "  sudo chown -R $CURRENT_USER:$CURRENT_USER backend frontend"
        exit 1
    fi
    
    # Check frontend directory
    if [ ! -d "frontend" ]; then
        print_error "Frontend directory does not exist!"
        exit 1
    fi
    
    if [ ! -w "frontend" ]; then
        print_error "Frontend directory is not writable by user '$CURRENT_USER'"
        print_info "Please run the following command to fix permissions:"
        print_info "  sudo chown -R $CURRENT_USER:$CURRENT_USER frontend"
        exit 1
    fi
    
    print_success "Directory permissions OK"
}

# Check Docker access
check_docker_access() {
    # If running as root, Docker is always accessible
    if [ "$EUID" -eq 0 ]; then
        DOCKER_CMD="docker"
        DOCKER_COMPOSE_CMD="docker compose"
        print_info "Running as root, Docker access granted"
        return 0
    fi
    
    if docker ps &>/dev/null; then
        DOCKER_CMD="docker"
        DOCKER_COMPOSE_CMD="docker compose"
        return 0
    elif sudo docker ps &>/dev/null; then
        print_warning "Docker requires sudo. Using sudo for Docker commands."
        DOCKER_CMD="sudo docker"
        DOCKER_COMPOSE_CMD="sudo docker compose"
        return 0
    else
        print_error "Cannot access Docker. Checking if user is in docker group..."
        CURRENT_USER=$(get_current_user)
        if groups | grep -q docker; then
            print_warning "User is in docker group but still cannot access Docker."
            print_info "You may need to log out and log back in, or run: newgrp docker"
            print_info "Alternatively, we can add you to the docker group now."
            read -p "Add user to docker group? (requires sudo password) [y/N]: " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo usermod -aG docker "$CURRENT_USER"
                print_warning "User added to docker group. Please log out and log back in, or run: newgrp docker"
                print_info "Then run this script again."
                exit 1
            fi
        else
            print_info "User is not in docker group. Adding to docker group..."
            sudo usermod -aG docker "$CURRENT_USER" || {
                print_error "Failed to add user to docker group."
                print_info "Please run manually: sudo usermod -aG docker $CURRENT_USER"
                print_info "Then log out and log back in, or run: newgrp docker"
                exit 1
            }
            print_warning "User added to docker group. Please log out and log back in, or run: newgrp docker"
            print_info "Then run this script again."
            exit 1
        fi
        return 1
    fi
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_info "Docker is not installed. Installing Docker..."
        install_docker
    else
        print_success "Docker is already installed: $(docker --version)"
    fi
    
    # Check Docker access
    check_docker_access
}

# Install Docker
install_docker() {
    print_info "Installing Docker..."
    
    # Update package index
    sudo apt-get update
    
    # Install prerequisites
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Set up repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    print_warning "You need to log out and log back in for docker group changes to take effect."
    
    print_success "Docker installed successfully"
}

# Check if Docker Compose is available
check_docker_compose() {
    if ! $DOCKER_COMPOSE_CMD version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose plugin."
        exit 1
    else
        print_success "Docker Compose is available: $($DOCKER_COMPOSE_CMD version)"
    fi
}

# Check and install Node.js if needed
check_nodejs() {
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        print_info "Node.js/npm is not installed. Installing Node.js 20.x..."
        
        # Check if we can use sudo or if we're root
        if [ "$EUID" -eq 0 ]; then
            # Running as root, use commands directly
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - || {
                print_error "Failed to add NodeSource repository"
                exit 1
            }
            apt-get update
            apt-get install -y nodejs || {
                print_error "Failed to install Node.js"
                exit 1
            }
        elif sudo -n true 2>/dev/null; then
            # Can use sudo without password
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - || {
                print_error "Failed to add NodeSource repository"
                exit 1
            }
            sudo apt-get update
            sudo apt-get install -y nodejs || {
                print_error "Failed to install Node.js"
                exit 1
            }
        else
            print_error "Node.js is not installed and sudo access is required."
            print_info "Please install Node.js manually as root:"
            print_info "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
            print_info "  apt-get update && apt-get install -y nodejs"
            print_info "Or add the current user to sudoers and run this script again."
            exit 1
        fi
        
        print_success "Node.js installed: $(node --version)"
        print_success "npm installed: $(npm --version)"
    else
        print_success "Node.js is already installed: $(node --version)"
        print_success "npm is already installed: $(npm --version)"
    fi
}

# Check if project is already deployed
check_existing_deployment() {
    if [ -f ".deployed" ]; then
        print_info "Existing deployment detected. This will be an UPDATE."
        return 0
    else
        print_info "No existing deployment found. This will be a NEW installation."
        return 1
    fi
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        print_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Backup database
backup_database() {
    if $DOCKER_CMD ps | grep -q "ftr_postgres"; then
        print_info "Creating database backup..."
        
        create_backup_dir
        
        $DOCKER_CMD exec ftr_postgres pg_dump -U ftr_user -d ftr_db > "$BACKUP_FILE" 2>/dev/null || {
            print_warning "Could not create database backup. Database might be empty or not accessible."
            return 1
        }
        
        # Compress backup
        gzip -f "$BACKUP_FILE"
        print_success "Database backed up to: ${BACKUP_FILE}.gz"
        
        # Keep only last 5 backups
        ls -t ${BACKUP_DIR}/backup_*.sql.gz | tail -n +6 | xargs -r rm
    else
        print_warning "PostgreSQL container is not running. Skipping backup."
    fi
}

# Save environment files
save_env_files() {
    print_info "Saving environment files..."
    
    if [ -f "backend/.env" ]; then
        cp backend/.env backend/.env.backup.${TIMESTAMP}
        print_success "Backend .env saved"
    fi
    
    if [ -f "frontend/.env" ]; then
        cp frontend/.env frontend/.env.backup.${TIMESTAMP}
        print_success "Frontend .env saved"
    fi
    
    if [ -f ".env" ]; then
        cp .env .env.backup.${TIMESTAMP}
        print_success "Root .env saved"
    fi
}

# Restore environment files
restore_env_files() {
    print_info "Restoring environment files..."
    
    # Find latest backup files
    LATEST_BACKEND_ENV=$(ls -t backend/.env.backup.* 2>/dev/null | head -1)
    LATEST_FRONTEND_ENV=$(ls -t frontend/.env.backup.* 2>/dev/null | head -1)
    LATEST_ROOT_ENV=$(ls -t .env.backup.* 2>/dev/null | head -1)
    
    if [ -n "$LATEST_BACKEND_ENV" ] && [ ! -f "backend/.env" ]; then
        cp "$LATEST_BACKEND_ENV" backend/.env
        print_success "Restored backend .env"
    fi
    
    if [ -n "$LATEST_FRONTEND_ENV" ] && [ ! -f "frontend/.env" ]; then
        cp "$LATEST_FRONTEND_ENV" frontend/.env
        print_success "Restored frontend .env"
    fi
    
    if [ -n "$LATEST_ROOT_ENV" ] && [ ! -f ".env" ]; then
        cp "$LATEST_ROOT_ENV" .env
        print_success "Restored root .env"
    fi
}

# Pull latest code from git (if git repository)
update_code() {
    if [ -d ".git" ]; then
        print_info "Updating code from git repository..."
        
        # Fix Git safe.directory issue if running as different user
        CURRENT_DIR=$(pwd)
        git config --global --add safe.directory "$CURRENT_DIR" 2>/dev/null || true
        
        # Check if there are uncommitted changes
        if ! git diff-index --quiet HEAD --; then
            print_warning "You have uncommitted changes. Stashing them..."
            git stash save "Auto-stash before deployment ${TIMESTAMP}"
        fi
        
        # Pull latest changes
        git pull origin main || git pull origin master || {
            print_warning "Could not pull from git. Using current code."
        }
        
        print_success "Code updated"
    else
        print_info "Not a git repository. Using current code."
    fi
}

# Create environment files if they don't exist
create_env_files() {
    print_info "Setting up environment files..."
    
    # Backend .env
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
            chmod 600 backend/.env 2>/dev/null || true
            print_info "Created backend/.env from .env.example"
        else
            # Generate secrets
            JWT_SECRET=$(openssl rand -hex 32)
            JWT_REFRESH_SECRET=$(openssl rand -hex 32)
            
            # Use tee instead of cat to avoid permission issues
            # Use localhost for migrations from host, postgres for Docker containers
            tee backend/.env > /dev/null << EOF
# Database
# Use localhost when running migrations from host, postgres when running in Docker
DATABASE_URL="postgresql://ftr_user:ftr_password@localhost:5432/ftr_db?schema=public"
# For Docker containers, use: postgresql://ftr_user:ftr_password@postgres:5432/ftr_db?schema=public

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Server
PORT=3001
NODE_ENV=production

# Redis
# Use localhost when running from host, redis when running in Docker
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS
CORS_ORIGIN=http://95.71.125.8:3000,http://95.71.125.8,http://localhost:3000,http://localhost:5173,http://localhost
EOF
            chmod 600 backend/.env 2>/dev/null || true
            print_info "Created backend/.env with default values"
        fi
    else
        # Ensure existing .env file has correct permissions
        chmod 600 backend/.env 2>/dev/null || true
        # Update DATABASE_URL to use localhost if it uses postgres (for migrations from host)
        if grep -q "@postgres:5432" backend/.env 2>/dev/null; then
            print_info "Updating DATABASE_URL to use localhost for host migrations..."
            sed -i 's/@postgres:5432/@localhost:5432/g' backend/.env 2>/dev/null || true
        fi
        # Update REDIS_HOST to use localhost if it uses redis (for connections from host)
        if grep -q "^REDIS_HOST=redis" backend/.env 2>/dev/null; then
            print_info "Updating REDIS_HOST to use localhost for host connections..."
            sed -i 's/^REDIS_HOST=redis/REDIS_HOST=localhost/g' backend/.env 2>/dev/null || true
        fi
        # Update CORS_ORIGIN to use production IP if it uses localhost only
        if grep -q "^CORS_ORIGIN=http://localhost" backend/.env 2>/dev/null && ! grep -q "95.71.125.8" backend/.env 2>/dev/null; then
            print_info "Updating CORS_ORIGIN to include production IP..."
            sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=http://95.71.125.8:3000,http://95.71.125.8,http://localhost:3000,http://localhost:5173,http://localhost|g' backend/.env 2>/dev/null || true
        fi
    fi
    
    # Frontend .env
    if [ ! -f "frontend/.env" ]; then
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env
            chmod 600 frontend/.env 2>/dev/null || true
            print_info "Created frontend/.env from .env.example"
        else
            tee frontend/.env > /dev/null << EOF
VITE_API_URL=http://95.71.125.8:3001
VITE_MODE=production
EOF
            chmod 600 frontend/.env 2>/dev/null || true
            print_info "Created frontend/.env with default values"
        fi
    else
        # Ensure existing .env file has correct permissions
        chmod 600 frontend/.env 2>/dev/null || true
        # Update VITE_API_URL if it uses localhost
        if grep -q "VITE_API_URL=http://localhost:3001" frontend/.env 2>/dev/null; then
            print_info "Updating VITE_API_URL to use production IP..."
            sed -i 's|VITE_API_URL=http://localhost:3001|VITE_API_URL=http://95.71.125.8:3001|g' frontend/.env 2>/dev/null || true
        fi
    fi
    
    print_success "Environment files ready"
}

# Start Docker services
start_docker_services() {
    print_info "Starting Docker services (PostgreSQL and Redis)..."
    
    # Use production docker-compose if it exists
    if [ -f "docker-compose.prod.yml" ]; then
        $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml up -d postgres redis
    else
        $DOCKER_COMPOSE_CMD up -d postgres redis
    fi
    
    # Wait for services to be healthy
    print_info "Waiting for services to be ready..."
    sleep 5
    
    # Check PostgreSQL
    for i in {1..30}; do
        if $DOCKER_CMD exec ftr_postgres pg_isready -U ftr_user -d ftr_db &>/dev/null; then
            print_success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start"
            exit 1
        fi
        sleep 2
    done
    
    # Check Redis
    for i in {1..30}; do
        if $DOCKER_CMD exec ftr_redis redis-cli ping &>/dev/null; then
            print_success "Redis is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Redis failed to start"
            exit 1
        fi
        sleep 2
    done
}

# Install backend dependencies
install_backend_deps() {
    print_info "Installing backend dependencies..."
    
    cd backend
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Backend dependencies installed"
    else
        npm install
        print_success "Backend dependencies updated"
    fi
    
    cd ..
}

# Install frontend dependencies
install_frontend_deps() {
    print_info "Installing frontend dependencies..."
    
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Frontend dependencies installed"
    else
        npm install
        print_success "Frontend dependencies updated"
    fi
    
    cd ..
}

# Run database migrations
run_migrations() {
    print_info "Running database migrations..."
    
    cd backend
    
    # Generate Prisma Client
    npx prisma generate
    
    # Check if migrations directory exists and has migrations
    if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
        print_info "No migrations found. Creating initial migration..."
        npx prisma migrate dev --name init --create-only || {
            print_error "Failed to create initial migration"
            exit 1
        }
        print_success "Initial migration created"
    fi
    
    # Run migrations
    npx prisma migrate deploy || {
        print_warning "Migration deploy failed. Trying to apply migrations manually..."
        # Try to apply migrations using migrate dev (for development)
        npx prisma migrate dev --name apply_migrations || {
            print_warning "Migration failed. Trying to reset..."
            read -p "Do you want to reset the database? This will DELETE ALL DATA! (yes/no): " -r
            if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
                npx prisma migrate reset --force
                npx prisma migrate deploy
            else
                print_error "Migration aborted"
                exit 1
            fi
        }
    }
    
    # Seed database - check if users exist, if not, run seed
    print_info "Checking if database needs seeding..."
    USER_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "0")
    if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
        print_info "No users found. Seeding database..."
        npx prisma db seed || print_warning "Seed failed, but continuing..."
    else
        print_info "Database already has users (count: $USER_COUNT). Skipping seed."
    fi
    
    cd ..
    
    print_success "Database migrations completed"
}

# Build backend
build_backend() {
    print_info "Building backend..."
    
    cd backend
    npm run build
    cd ..
    
    print_success "Backend built successfully"
}

# Build frontend
build_frontend() {
    print_info "Building frontend..."
    
    cd frontend
    
    # Ensure .env file exists with API URL
    if [ ! -f ".env" ]; then
        echo "VITE_API_URL=http://95.71.125.8:3001" > .env
    else
        # Update existing .env if it has localhost
        if grep -q "VITE_API_URL=http://localhost:3001" .env 2>/dev/null; then
            sed -i 's|VITE_API_URL=http://localhost:3001|VITE_API_URL=http://95.71.125.8:3001|g' .env 2>/dev/null || true
        fi
    fi
    
    # Load environment variables and build
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    npm run build
    cd ..
    
    print_success "Frontend built successfully"
}

# Start application (without Docker for backend/frontend - run directly on host)
start_application() {
    print_info "Starting application services..."
    
    # Start backend as a background process
    print_info "Starting backend server..."
    cd backend
    
    # Check if backend is already running
    if pgrep -f "node.*dist/index.js" > /dev/null; then
        print_warning "Backend is already running"
    else
        # Start backend in background
        nohup npm start > ../backend.log 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID > ../backend.pid
        print_success "Backend started (PID: $BACKEND_PID)"
        
        # Wait a bit for backend to start
        sleep 3
        
        # Check if backend is running
        if ! kill -0 $BACKEND_PID 2>/dev/null; then
            print_error "Backend failed to start. Check backend.log for details."
            exit 1
        fi
    fi
    
    cd ..
    
    # For frontend, we'll use a simple HTTP server since it's already built
    print_info "Starting frontend server..."
    cd frontend
    
    # Check if frontend server is already running
    if pgrep -f "serve.*dist" > /dev/null || pgrep -f "vite.*preview" > /dev/null || pgrep -f "node.*serve" > /dev/null; then
        print_warning "Frontend server is already running"
    else
        # Use npx serve with proper SPA configuration
        if command -v npx &> /dev/null; then
            # Start frontend server using npx serve with SPA mode
            # -s flag enables single-page app mode (all routes serve index.html)
            # -l sets the port and bind to all interfaces (0.0.0.0)
            # Use serve.json config file for proper SPA routing
            print_info "Starting frontend on 0.0.0.0:3000..."
            if [ -f "serve.json" ]; then
                nohup npx -y serve@latest -s dist -l tcp://0.0.0.0:3000 -c serve.json > ../frontend.log 2>&1 &
            else
                nohup npx -y serve@latest -s dist -l tcp://0.0.0.0:3000 > ../frontend.log 2>&1 &
            fi
            FRONTEND_PID=$!
            echo $FRONTEND_PID > ../frontend.pid
            print_success "Frontend started (PID: $FRONTEND_PID) on port 3000"
            
            # Wait longer for serve to start
            sleep 5
            
            # Verify it's running
            if ! kill -0 $FRONTEND_PID 2>/dev/null; then
                print_error "Frontend process died. Check frontend.log:"
                tail -20 ../frontend.log
                exit 1
            fi
            
            # Test if server is responding
            sleep 2
            if curl -s http://95.71.125.8:3000 > /dev/null 2>&1 || curl -s http://localhost:3000 > /dev/null 2>&1; then
                print_success "Frontend server is responding"
            else
                print_warning "Frontend server may not be responding yet. Check logs: tail -f frontend.log"
            fi
        else
            print_error "npx is not available. Cannot start frontend server."
            exit 1
        fi
        
        # Wait a bit for frontend to start
        sleep 3
        
        # Check if frontend is running
        if ! kill -0 $FRONTEND_PID 2>/dev/null; then
            print_error "Frontend failed to start. Check frontend.log for details."
            exit 1
        fi
    fi
    
    cd ..
    
    print_success "Application services started"
    print_info "Backend: http://95.71.125.8:3001"
    print_info "Frontend: http://95.71.125.8:3000"
    print_info "Logs: backend.log, frontend.log"
}

# Show deployment status
show_status() {
    print_info "Checking deployment status..."
    
    echo ""
    echo "=== Container Status ==="
    if [ -f "docker-compose.prod.yml" ]; then
        $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml ps
    else
        $DOCKER_COMPOSE_CMD ps
    fi
    
    echo ""
    echo "=== Service URLs ==="
    if [ -f "docker-compose.prod.yml" ]; then
        echo "Backend API: http://95.71.125.8:3001"
        echo "Frontend: http://95.71.125.8:3000"
        echo "PostgreSQL: localhost:5432"
        echo "Redis: localhost:6379"
    else
        echo "Backend API: http://95.71.125.8:3001"
        echo "Frontend: http://95.71.125.8:3000"
        echo "PostgreSQL: localhost:5432"
        echo "Redis: localhost:6379"
    fi
    
    echo ""
    echo "=== Logs ==="
    if [ -f "docker-compose.prod.yml" ]; then
        echo "View database/redis logs with: $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml logs -f"
        echo "View backend logs: tail -f backend.log"
        echo "View frontend logs: tail -f frontend.log"
        echo "Backend PID file: backend.pid"
        echo "Frontend PID file: frontend.pid"
    else
        echo "View logs with: $DOCKER_COMPOSE_CMD logs -f"
        echo "View backend logs: $DOCKER_COMPOSE_CMD logs -f backend"
        echo "View frontend logs: $DOCKER_COMPOSE_CMD logs -f frontend"
    fi
}

# Main deployment function
main() {
    print_info "Starting FTR Registration System deployment..."
    echo ""
    
    # Check root
    check_root
    
    # Check directory permissions
    check_permissions
    
    # Check/Install Docker
    check_docker
    check_docker_compose
    
    # Check/Install Node.js
    check_nodejs
    
    # If running as root, ensure APP_USER has proper permissions
    if [ "$EUID" -eq 0 ] && [ -n "$APP_USER" ] && [ "$APP_USER" != "root" ]; then
        print_info "Setting ownership of project files to $APP_USER..."
        chown -R "$APP_USER:$APP_USER" . 2>/dev/null || true
    fi
    
    # Check if update or new installation
    IS_UPDATE=false
    if check_existing_deployment; then
        IS_UPDATE=true
        print_info "UPDATE MODE: Existing deployment will be updated"
        
        # Backup before update
        backup_database
        save_env_files
    else
        print_info "INSTALL MODE: New installation"
    fi
    
    # Update code if git repository
    update_code
    
    # Restore environment files if updating
    if [ "$IS_UPDATE" = true ]; then
        restore_env_files
    fi
    
    # Create environment files if needed
    create_env_files
    
    # Start Docker services
    start_docker_services
    
    # Install dependencies
    install_backend_deps
    install_frontend_deps
    
    # Run migrations
    run_migrations
    
    # Build applications
    build_backend
    build_frontend
    
    # Start application
    start_application
    
    # Mark as deployed
    touch .deployed
    echo "$TIMESTAMP" > .deployed
    
    # Show status
    show_status
    
    echo ""
    print_success "Deployment completed successfully!"
    
    if [ "$IS_UPDATE" = true ]; then
        print_info "This was an UPDATE. Your data has been preserved."
        if [ -f "${BACKUP_FILE}.gz" ]; then
            print_info "Database backup saved to: ${BACKUP_FILE}.gz"
        fi
    else
        print_info "This was a NEW installation."
        print_info "Default credentials:"
        print_info "  ADMIN: admin@ftr.ru / admin123"
        print_info "  REGISTRATOR: registrar@ftr.ru / registrar123"
        print_info "  ACCOUNTANT: accountant@ftr.ru / accountant123"
        print_info "  STATISTICIAN: statistician@ftr.ru / statistician123"
    fi
}

# Run main function
main "$@"

