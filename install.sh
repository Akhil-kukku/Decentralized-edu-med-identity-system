#!/bin/bash

echo "🚀 Installing Advanced DID System Dependencies..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Clear existing dependencies
echo "🧹 Cleaning existing dependencies..."
rm -rf node_modules
rm -f package-lock.json

# Clear npm cache
echo "🧹 Clearing npm cache..."
npm cache clean --force

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if installation was successful
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
    echo "🔧 Troubleshooting:"
    echo "   - Try: npm install --legacy-peer-deps"
    echo "   - Try: npm install --force"
    echo "   - Check your internet connection"
    echo "   - Make sure you have sufficient disk space"
fi

