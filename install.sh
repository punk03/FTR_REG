#!/bin/bash

# FTR Registration System - Installation/Update Script for Ubuntu 24
# Скрипт для установки и обновления проекта с GitHub

set -e  # Exit on error

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

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then 
        print_error "Please do not run this script as root. Run as regular user with sudo privileges."
        exit 1
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
    
    CURRENT_USER=$(whoami)
    
    # Fix ownership
    sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$PROJECT_DIR" 2>/dev/null || {
        print_warning "Could not change ownership. You may need to run: sudo chown -R $CURRENT_USER:$CURRENT_USER $PROJECT_DIR"
    }
    
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
    
    # Run deployment
    ./deploy.sh || {
        print_error "Deployment failed. Please check the error messages above."
        exit 1
    }
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

