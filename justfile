# Default recipe (lists all available commands)
default:
    @just --list

# Start development environment
dev:
    npm run dev

# Preview the production build locally
preview:
    npm run start

# Compile assets and perform typechecking
build:
    npm run build

# Package the application for the current platform
package:
    npm run build && npx electron-builder

# Package for Windows
package-win:
    npm run build:win

# Package for macOS
package-mac:
    npm run build:mac

# Package for Linux
package-linux:
    npm run build:linux

# Create a new version release (e.g. just bump 0.2.1)
bump version:
    node scripts/bump-version.mjs {{version}}

# Code hygiene and quality checks
lint:
    npm run lint

# Format code using Prettier
format:
    npm run format

# Run TypeScript type checking
typecheck:
    npm run typecheck

# Install/Update dependencies
install:
    npm install

# Remove build artifacts
clean:
    rm -rf dist out
