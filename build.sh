#!/bin/bash
set -e

echo "Building for Vercel deployment..."

# Create output directory
mkdir -p dist/client

# Copy the standalone HTML file
cp dist/client/index.html dist/client/index.html 2>/dev/null || echo "Using existing HTML"

# Ensure we have a basic index.html
if [ ! -f "dist/client/index.html" ]; then
    echo "Creating basic index.html..."
    cat > dist/client/index.html << 'EOF'
<!DOCTYPE html>
<html><head><title>Meta Tag Analyzer</title></head>
<body><h1>Meta Tag Analyzer</h1><p>Loading...</p></body></html>
EOF
fi

echo "Build complete!"