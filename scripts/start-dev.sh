#!/bin/bash

# OpenCut Development Server Startup Script
# Starts all required services for local development

set -e

echo "🚀 Starting OpenCut Development Services..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Start Docker services
echo ""
echo "🐘 Starting PostgreSQL, Redis, and Redis HTTP..."
docker compose up -d db redis serverless-redis-http

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check database health
echo "📋 Checking database connection..."
until docker compose exec db pg_isready -U opencut > /dev/null 2>&1; do
    echo "⏳ Database not ready yet..."
    sleep 2
done
echo -e "${GREEN}✅ Database is ready${NC}"

# Check redis health
echo "🔴 Checking Redis..."
until docker compose exec redis redis-cli ping > /dev/null 2>&1; do
    echo "⏳ Redis not ready yet..."
    sleep 2
done
echo -e "${GREEN}✅ Redis is ready${NC}"

echo ""
echo -e "${YELLOW}📚 Services are running!${NC}"
echo ""
echo "To start the backend and frontend in separate terminals:"
echo ""
echo -e "${GREEN}Terminal 1 (Backend):${NC}"
echo "  cd apps/api && python -m uvicorn app.main:app --reload --port 8000"
echo ""
echo -e "${GREEN}Terminal 2 (Frontend):${NC}"
echo "  cd apps/web && bun dev"
echo ""
echo "Or use Docker:"
echo "  docker compose up api web"
echo ""
echo "Then visit:"
echo -e "  ${GREEN}Frontend: http://localhost:3000${NC}"
echo -e "  ${GREEN}Backend API: http://localhost:8000${NC}"
echo -e "  ${GREEN}API Docs: http://localhost:8000/docs${NC}"
echo ""
echo "To test API communication:"
echo "  Open browser console and run: testAPIConnection()"
echo "  (After importing from src/utils/api-test.ts)"
