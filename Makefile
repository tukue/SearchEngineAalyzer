.PHONY: install dev build test docker docker-run docker-down clean

# Install dependencies
install:
	npm ci

# Run development server
dev:
	npm run dev

# Build the application
build:
	npm run build

# Run tests
test:
	./npm-test.sh

# End-to-end tests (requires running application)
e2e:
	node e2e-test.js

# Build Docker image
docker:
	docker-compose build

# Run with Docker
docker-run:
	docker-compose up -d

# Stop Docker containers
docker-down:
	docker-compose down

# Clean up build artifacts
clean:
	rm -rf dist
	rm -rf node_modules

# Full CI/CD testing workflow
ci: install test

# Deploy to production (example placeholder)
deploy: build
	@echo "Deploying to production..."
	@echo "This is a placeholder. Configure your actual deployment steps here."

# Help command
help:
	@echo "Meta Tag Analyzer - Development Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make install       Install dependencies"
	@echo "  make dev           Start development server"
	@echo "  make build         Build for production"
	@echo "  make test          Run all tests"
	@echo "  make e2e           Run end-to-end tests (requires running server)"
	@echo "  make docker        Build Docker image"
	@echo "  make docker-run    Run application in Docker container"
	@echo "  make docker-down   Stop Docker containers"
	@echo "  make clean         Clean up build artifacts"
	@echo "  make ci            Run CI workflow (install + test)"
	@echo "  make deploy        Deploy to production (placeholder)"
	@echo "  make help          Show this help message"

# Default target
default: help