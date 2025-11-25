#!/bin/bash

# FTR Registration System - Installation/Update Script for Ubuntu 24
# Скрипт для установки и обновления проекта с GitHub

set -e  # Exit on error

# Ensure script is executable
if [ ! -x "$0" ]; then
    chmod +x "$0" 2>/dev/null || {
        echo "Error: Cannot make script executable. Please run: chmod +x $0"
        exit 1
    }
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="https://github.com/punk03/FTR_REG.git"
PROJECT_DIR="${HOME}/FTR_REG"
BRANCH="main"

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

# Check if running as root and handle accordingly
check_root() {
    if [ "$EUID" -eq 0 ]; then 
        print_warning "Running as root. This is allowed."
        print_info "The script will create/use a dedicated user for the application if needed."
        
        # Try to find an existing user for FTR, or use a default
        if id "ftr" &>/dev/null; then
            APP_USER="ftr"
            print_info "Found existing 'ftr' user, will use it for application files"
        elif id "fil" &>/dev/null; then
            APP_USER="fil"
            print_info "Found existing 'fil' user, will use it for application files"
        else
            # Create dedicated user for FTR application
            print_info "Creating dedicated user 'ftr' for the application..."
            useradd -r -s /bin/bash -d "$HOME/FTR_REG" -m ftr 2>/dev/null || {
                print_warning "Could not create 'ftr' user. Will use current directory owner."
                APP_USER=$(stat -c '%U' . 2>/dev/null || echo "root")
            }
            APP_USER="ftr"
            print_success "Created user 'ftr' for application"
        fi
        
        # Ensure APP_USER is set
        export APP_USER
    else
        APP_USER=$(whoami)
        export APP_USER
    fi
}

# Check if git is installed
check_git() {
    if ! command -v git &> /dev/null; then
        print_info "Git is not installed. Installing git..."
        sudo apt-get update
        sudo apt-get install -y git
        print_success "Git installed successfully"
    else
        print_success "Git is already installed: $(git --version)"
    fi
}

# Clone or update repository
setup_repository() {
    if [ -d "$PROJECT_DIR/.git" ]; then
        print_info "Repository already exists. Updating from GitHub..."
        cd "$PROJECT_DIR"
        
        # Check if there are uncommitted changes
        if [ -n "$(git status --porcelain)" ]; then
            print_warning "There are uncommitted changes in the repository."
            print_info "Stashing changes..."
            git stash save "Auto-stash before update $(date +%Y%m%d_%H%M%S)"
        fi
        
        # Fetch latest changes
        print_info "Fetching latest changes from GitHub..."
        git fetch origin
        
        # Check current branch
        CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
        
        if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
            print_info "Switching to branch: $BRANCH"
            git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
        fi
        
        # Pull latest changes
        print_info "Pulling latest changes..."
        git pull origin "$BRANCH" || {
            print_error "Failed to pull changes. Please resolve conflicts manually."
            exit 1
        }
        
        print_success "Repository updated successfully"
    else
        print_info "Repository does not exist. Cloning from GitHub..."
        
        # Create parent directory if it doesn't exist
        mkdir -p "$(dirname "$PROJECT_DIR")"
        
        # Clone repository
        git clone "$GITHUB_REPO" "$PROJECT_DIR" || {
            print_error "Failed to clone repository. Please check your internet connection and GitHub access."
            exit 1
        }
        
        cd "$PROJECT_DIR"
        
        # Checkout specified branch
        if [ "$BRANCH" != "main" ]; then
            git checkout "$BRANCH" 2>/dev/null || print_warning "Branch $BRANCH not found, using default branch"
        fi
        
        print_success "Repository cloned successfully"
    fi
}

# Set correct permissions
fix_permissions() {
    print_info "Setting correct permissions..."
    
    if [ "$EUID" -eq 0 ]; then
        # Running as root, use APP_USER
        CURRENT_USER="${APP_USER:-ftr}"
        chown -R "$CURRENT_USER:$CURRENT_USER" "$PROJECT_DIR" 2>/dev/null || {
            print_warning "Could not change ownership. You may need to run: chown -R $CURRENT_USER:$CURRENT_USER $PROJECT_DIR"
        }
    else
        CURRENT_USER=$(whoami)
        # Fix ownership
        sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$PROJECT_DIR" 2>/dev/null || {
            print_warning "Could not change ownership. You may need to run: sudo chown -R $CURRENT_USER:$CURRENT_USER $PROJECT_DIR"
        }
    fi
    
    # Make scripts executable
    chmod +x "$PROJECT_DIR/deploy.sh" 2>/dev/null || true
    chmod +x "$PROJECT_DIR/start.sh" 2>/dev/null || true
    chmod +x "$PROJECT_DIR/install.sh" 2>/dev/null || true
    
    print_success "Permissions set correctly"
}

# Run deployment script
run_deployment() {
    print_info "Running deployment script..."
    cd "$PROJECT_DIR"
    
    if [ ! -f "deploy.sh" ]; then
        print_error "deploy.sh not found in project directory!"
        exit 1
    fi
    
    # Make sure deploy.sh is executable
    chmod +x deploy.sh
    
    # If running as root and APP_USER is set, run deploy.sh as that user
    if [ "$EUID" -eq 0 ] && [ -n "$APP_USER" ] && [ "$APP_USER" != "root" ]; then
        print_info "Running deploy.sh as user $APP_USER..."
        sudo -u "$APP_USER" ./deploy.sh || {
            print_error "Deployment failed. Please check the error messages above."
            exit 1
        }
    else
        # Run deployment as current user
        ./deploy.sh || {
            print_error "Deployment failed. Please check the error messages above."
            exit 1
        }
    fi
}

# Show summary
show_summary() {
    echo ""
    echo "=========================================="
    print_success "Installation/Update completed!"
    echo "=========================================="
    echo ""
    echo "Project location: $PROJECT_DIR"
    echo "GitHub repository: $GITHUB_REPO"
    echo "Branch: $BRANCH"
    echo ""
    echo "To update the project in the future, simply run:"
    echo "  $0"
    echo ""
    echo "Or manually:"
    echo "  cd $PROJECT_DIR"
    echo "  git pull origin $BRANCH"
    echo "  ./deploy.sh"
    echo ""
}

# Main function
main() {
    print_info "FTR Registration System - Installation/Update Script"
    echo ""
    
    # Check root
    check_root
    
    # Check git
    check_git
    
    # Setup repository
    setup_repository
    
    # Fix permissions
    fix_permissions
    
    # Run deployment
    run_deployment
    
    # Show summary
    show_summary
}

# Run main function
main

