@echo off
echo 🚀 Installing Advanced DID System Dependencies...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+ first.
    pause
    exit /b 1
)

echo ✅ Node.js version:
node --version

REM Clear existing dependencies
echo 🧹 Cleaning existing dependencies...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

REM Clear npm cache
echo 🧹 Clearing npm cache...
npm cache clean --force

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Check if installation was successful
if %errorlevel% equ 0 (
    echo ✅ Dependencies installed successfully!
    
    REM Compile contracts
    echo 🔨 Compiling contracts...
    npx hardhat compile
    
    if %errorlevel% equ 0 (
        echo ✅ Contracts compiled successfully!
        
        REM Run tests
        echo 🧪 Running tests...
        npx hardhat test
        
        if %errorlevel% equ 0 (
            echo 🎉 Setup completed successfully!
            echo.
            echo 📋 Next steps:
            echo    1. Start local blockchain: npm run node
            echo    2. Deploy contracts: npm run deploy:local
            echo    3. Open frontend: start frontend/index.html
        ) else (
            echo ❌ Tests failed. Please check the error messages above.
        )
    ) else (
        echo ❌ Contract compilation failed. Please check the error messages above.
    )
) else (
    echo ❌ Dependency installation failed. Please check the error messages above.
    echo.
    echo 🔧 Troubleshooting:
    echo    - Try: npm install --legacy-peer-deps
    echo    - Try: npm install --force
    echo    - Check your internet connection
    echo    - Make sure you have sufficient disk space
)

pause

