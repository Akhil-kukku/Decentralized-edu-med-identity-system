@echo off
cd /d "c:\Users\akhil\Downloads\BT---small-project-main (1)\BT---small-project-main\DEMISE\decentralized-identity-js"
timeout /t 5 >nul
npx hardhat run scripts/deployV2.js --network localhost
pause
