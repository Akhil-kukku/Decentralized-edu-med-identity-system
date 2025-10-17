@echo off
echo 🔧 Fixing dependency conflicts...

REM Clean everything
echo 🧹 Cleaning existing files...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
if exist cache rmdir /s /q cache
if exist artifacts rmdir /s /q artifacts

REM Clear npm cache
echo 🧹 Clearing npm cache...
npm cache clean --force

REM Install with legacy peer deps
echo 📦 Installing dependencies with legacy peer deps...
npm install --legacy-peer-deps

REM Check if successful
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
    echo 🔧 Try these alternatives:
    echo    npm install --force
    echo    npm install --legacy-peer-deps --force
)

pause
