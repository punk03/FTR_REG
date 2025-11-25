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

# Get current user (works with sudo -u)
get_current_user() {
    if [ -n "$SUDO_USER" ]; then
        echo "$SUDO_USER"
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
    if docker ps | grep -q "ftr_postgres"; then
        print_info "Creating database backup..."
        
        create_backup_dir
        
        docker exec ftr_postgres pg_dump -U ftr_user -d ftr_db > "$BACKUP_FILE" 2>/dev/null || {
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
            tee backend/.env > /dev/null << EOF
# Database
DATABASE_URL="postgresql://ftr_user:ftr_password@postgres:5432/ftr_db?schema=public"

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Server
PORT=3001
NODE_ENV=production

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS
CORS_ORIGIN=http://localhost
EOF
            chmod 600 backend/.env 2>/dev/null || true
            print_info "Created backend/.env with default values"
        fi
    else
        # Ensure existing .env file has correct permissions
        chmod 600 backend/.env 2>/dev/null || true
    fi
    
    # Frontend .env
    if [ ! -f "frontend/.env" ]; then
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env
            chmod 600 frontend/.env 2>/dev/null || true
            print_info "Created frontend/.env from .env.example"
        else
            tee frontend/.env > /dev/null << EOF
VITE_API_URL=http://localhost:3001
EOF
            chmod 600 frontend/.env 2>/dev/null || true
            print_info "Created frontend/.env with default values"
        fi
    else
        # Ensure existing .env file has correct permissions
        chmod 600 frontend/.env 2>/dev/null || true
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
    
    # Run migrations
    npx prisma migrate deploy || {
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
    
    # Seed database only on first deployment
    if [ ! -f "../.deployed" ]; then
        print_info "Seeding database..."
        npx prisma db seed || print_warning "Seed failed or already executed"
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
    npm run build
    cd ..
    
    print_success "Frontend built successfully"
}

# Build and start application containers
start_application() {
    print_info "Building and starting application containers..."
    
    # Use production docker-compose if it exists, otherwise use regular one
    if [ -f "docker-compose.prod.yml" ]; then
        $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml build --no-cache
        $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml up -d
    else
        $DOCKER_COMPOSE_CMD build --no-cache
        $DOCKER_COMPOSE_CMD up -d
    fi
    
    print_success "Application containers started"
}

# Show deployment status
show_status() {
    print_info "Checking deployment status..."
    
    echo ""
    echo "=== Container Status ==="
    if [ -f "docker-compose.prod.yml" ]; then
        docker compose -f docker-compose.prod.yml ps
    else
        docker compose ps
    fi
    
    echo ""
    echo "=== Service URLs ==="
    if [ -f "docker-compose.prod.yml" ]; then
        echo "Backend API: http://localhost:3001"
        echo "Frontend: http://localhost"
        echo "PostgreSQL: localhost:5432"
        echo "Redis: localhost:6379"
    else
        echo "Backend API: http://localhost:3001"
        echo "Frontend: http://localhost:5173"
        echo "PostgreSQL: localhost:5432"
        echo "Redis: localhost:6379"
    fi
    
    echo ""
    echo "=== Logs ==="
    if [ -f "docker-compose.prod.yml" ]; then
        echo "View logs with: docker compose -f docker-compose.prod.yml logs -f"
        echo "View backend logs: docker compose -f docker-compose.prod.yml logs -f backend"
        echo "View frontend logs: docker compose -f docker-compose.prod.yml logs -f frontend"
    else
        echo "View logs with: docker compose logs -f"
        echo "View backend logs: docker compose logs -f backend"
        echo "View frontend logs: docker compose logs -f frontend"
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

