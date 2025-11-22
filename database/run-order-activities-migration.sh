#!/bin/bash
# Order Activities Migration Script (Linux/Mac)
# This script runs the order activities table migration and data backfill
# Usage: ./run-order-activities-migration.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Check if psql is available
if ! command_exists psql; then
    echo -e "${RED}Error: PostgreSQL client (psql) not found${NC}"
    echo -e "${YELLOW}Please install PostgreSQL client:${NC}"
    echo -e "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo -e "  CentOS/RHEL: sudo yum install postgresql"
    echo -e "  macOS: brew install postgresql"
    exit 1
fi

echo -e "${GREEN}Found PostgreSQL client: $(which psql)${NC}"

# Step 2: Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ENV_PATH="$SCRIPT_DIR/../backend/.env"

# Step 3: Read database configuration
# Priority: script arguments > .env file > environment variables > prompt

# Function to read .env file
read_env_file() {
    if [ -f "$1" ]; then
        export $(grep -v '^#' "$1" | grep -v '^$' | xargs)
    fi
}

# Read from .env file if exists
if [ -f "$BACKEND_ENV_PATH" ]; then
    echo -e "${CYAN}Reading database configuration from: $BACKEND_ENV_PATH${NC}"
    read_env_file "$BACKEND_ENV_PATH"
else
    echo -e "${YELLOW}Warning: .env file not found at $BACKEND_ENV_PATH${NC}"
    echo -e "${YELLOW}Trying to read from environment variables...${NC}"
fi

# Get database connection details
DB_HOST="${1:-${DB_HOST:-${DB_HOST:-}}}"
if [ -z "$DB_HOST" ]; then
    read -p "Enter database host (default: localhost): " DB_HOST
    DB_HOST="${DB_HOST:-localhost}"
fi

DB_PORT="${2:-${DB_PORT:-5432}}"
if [ -z "$DB_PORT" ]; then
    read -p "Enter database port (default: 5432): " DB_PORT
    DB_PORT="${DB_PORT:-5432}"
fi

DB_USER="${3:-${DB_USER:-}}"
if [ -z "$DB_USER" ]; then
    read -p "Enter database user (default: postgres): " DB_USER
    DB_USER="${DB_USER:-postgres}"
fi

DB_NAME="${4:-${DB_NAME:-}}"
if [ -z "$DB_NAME" ]; then
    read -p "Enter database name: " DB_NAME
    if [ -z "$DB_NAME" ]; then
        echo -e "${RED}Error: Database name is required${NC}"
        exit 1
    fi
fi

DB_PASSWORD="${5:-${DB_PASSWORD:-}}"
if [ -z "$DB_PASSWORD" ]; then
    read -sp "Enter database password: " DB_PASSWORD
    echo
fi

# Set environment variables for psql
export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="UTF8"

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}Database Migration Configuration${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "Host: ${DB_HOST}"
echo -e "Port: ${DB_PORT}"
echo -e "User: ${DB_USER}"
echo -e "Database: ${DB_NAME}"
echo -e "${CYAN}========================================${NC}\n"

# Step 4: Find and run migrations
MIGRATION_DIR="$SCRIPT_DIR/migrations"

# Find all order activities related migration files
# Pattern: files starting with numbers and containing "order_activities" or "order-activities" in name
MIGRATION_FILES=$(find "$MIGRATION_DIR" -maxdepth 1 -name "*.sql" -type f | \
    grep -E '^[0-9]+.*order[_-]activit|^[0-9]+.*activit.*order' | \
    sort -t/ -k$(echo "$MIGRATION_DIR" | tr '/' '\n' | wc -l | awk '{print $1+1}') -k1.1,1.10n)

# If no specific pattern found, use all numbered migration files
if [ -z "$MIGRATION_FILES" ]; then
    echo -e "${YELLOW}No migration files found matching pattern. Looking for all numbered migration files...${NC}"
    MIGRATION_FILES=$(find "$MIGRATION_DIR" -maxdepth 1 -name "[0-9]*_*.sql" -type f | \
        sort -t/ -k$(echo "$MIGRATION_DIR" | tr '/' '\n' | wc -l | awk '{print $1+1}') -k1.1,1.10n)
fi

# Alternative: simpler sorting by filename
if [ -z "$MIGRATION_FILES" ]; then
    MIGRATION_FILES=$(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | \
        grep -E '^[0-9]+' | \
        sort -V)
fi

if [ -z "$MIGRATION_FILES" ]; then
    echo -e "${RED}Error: No migration files found in $MIGRATION_DIR${NC}"
    exit 1
fi

# Count migration files
MIGRATION_COUNT=$(echo "$MIGRATION_FILES" | wc -l | tr -d ' ')
echo -e "\n${CYAN}Found $MIGRATION_COUNT migration file(s) to execute:${NC}"
echo "$MIGRATION_FILES" | while read -r file; do
    echo -e "  - $(basename "$file")"
done
echo ""

# Execute migrations in order
STEP_NUMBER=1
while IFS= read -r migration_file; do
    if [ -z "$migration_file" ] || [ ! -f "$migration_file" ]; then
        continue
    fi
    
    filename=$(basename "$migration_file")
    echo -e "${YELLOW}Step $STEP_NUMBER: Executing $filename...${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
        echo -e "${RED}Step $STEP_NUMBER failed! Migration: $filename${NC}"
        exit 1
    fi
    echo -e "${GREEN}Step $STEP_NUMBER completed successfully!${NC}"
    STEP_NUMBER=$((STEP_NUMBER + 1))
done <<< "$MIGRATION_FILES"

echo -e "\n${CYAN}========================================${NC}"
echo -e "${GREEN}Migration completed successfully!${NC}"
echo -e "${CYAN}========================================${NC}"

# Clean up
unset PGPASSWORD

