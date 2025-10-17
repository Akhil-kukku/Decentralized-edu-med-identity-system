@echo off
echo.
echo ========================================
echo   Deploying Smart Contracts...
echo ========================================
echo.
echo Make sure Hardhat node is running!
echo.
timeout /t 3
cd /d "c:\Users\akhil\Downloads\BT---small-project-main (1)\BT---small-project-main\DEMISE\decentralized-identity-js"
npx hardhat run scripts/deployV2.js --network localhost
echo.
echo ========================================
echo   IMPORTANT: Copy the addresses above!
echo ========================================
echo.
pause
