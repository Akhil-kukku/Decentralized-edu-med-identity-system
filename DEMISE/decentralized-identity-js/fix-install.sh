#!/bin/bash

echo "🔧 Fixing dependency conflicts..."

# Clean everything
echo "🧹 Cleaning existing files..."
rm -rf node_modules
rm -f package-lock.json
rm -rf cache
rm -rf artifacts

# Clear npm cache
echo "🧹 Clearing npm cache..."
npm cache clean --force

# Install with legacy peer deps
echo "📦 Installing dependencies with legacy peer deps..."
npm install --legacy-peer-deps

# Check if successful
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    
    # Compile contracts
    echo "🔨 Compiling contracts..."
    npx hardhat compile
    
    if [ $? -eq 0 ]; then
        echo "✅ Contracts compiled successfully!"
        
        # Run tests
        echo "🧪 Running tests..."
        npx hardhat test
        
        if [ $? -eq 0 ]; then
            echo "🎉 Setup completed successfully!"
            echo ""
            echo "📋 Next steps:"
            echo "   1. Start local blockchain: npm run node"
            echo "   2. Deploy contracts: npm run deploy:local"
            echo "   3. Open frontend: open frontend/index.html"
        else
            echo "❌ Tests failed. Please check the error messages above."
        fi
    else
        echo "❌ Contract compilation failed. Please check the error messages above."
    fi
else
    echo "❌ Dependency installation failed. Please check the error messages above."
    echo ""
    echo "🔧 Try these alternatives:"
    echo "   npm install --force"
    echo "   npm install --legacy-peer-deps --force"
fi
