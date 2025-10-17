# 🚀 Quick Start Guide - Your Project is Ready!

## ✅ What's Already Done:
1. ✅ Dependencies installed
2. ✅ Smart contracts compiled successfully
3. ✅ Hardhat node started (check the PowerShell window that opened)

## 🎯 Next Steps to Complete Setup:

### Step 1: Deploy Contracts (REQUIRED)
Open a **NEW PowerShell window** and run:
```powershell
cd "c:\Users\akhil\Downloads\BT---small-project-main (1)\BT---small-project-main\DEMISE\decentralized-identity-js"
npx hardhat run scripts/deployV2.js --network localhost
```

**IMPORTANT:** Copy the contract addresses from the output! You'll need them for the frontend.

### Step 2: Update Frontend with Contract Addresses
1. Open `frontend/app.js` in VS Code
2. Find lines 11-14 (around the `contractAddresses` object)
3. Replace with the addresses from Step 1:
```javascript
this.contractAddresses = {
    identityRegistry: "0xYOUR_IDENTITY_REGISTRY_ADDRESS",
    credentialRegistry: "0xYOUR_CREDENTIAL_REGISTRY_ADDRESS"
};
```

### Step 3: Open the Frontend
Simply double-click: `frontend/index.html`

Or serve it properly:
```powershell
cd frontend
python -m http.server 8000
# Then open: http://localhost:8000
```

### Step 4: Setup MetaMask
1. **Install MetaMask** browser extension (if not already installed)
2. **Add Localhost Network:**
   - Network Name: `Localhost 8545`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `1337`
   - Currency Symbol: `ETH`

3. **Import Test Account:**
   - In the Hardhat node window, copy any private key
   - In MetaMask: Import Account → Paste private key
   - You should see 10000 ETH

### Step 5: Start Using the DApp!
1. Open `frontend/index.html` in your browser
2. Click "Connect Wallet"
3. Approve MetaMask connection
4. Start creating DIDs and credentials!

## 🆘 Troubleshooting

### If Deployment Fails:
Make sure the Hardhat node is still running (check the PowerShell window).
If not, restart it:
```powershell
cd "c:\Users\akhil\Downloads\BT---small-project-main (1)\BT---small-project-main\DEMISE\decentralized-identity-js"
npx hardhat node
```

### If MetaMask Transactions Fail:
- Reset MetaMask account: Settings → Advanced → Clear activity tab data
- Make sure you're connected to "Localhost 8545" network

### If Frontend Can't Connect:
- Verify contract addresses in `frontend/app.js` match deployment output
- Check browser console (F12) for errors
- Ensure MetaMask is connected

## 📋 Quick Reference Commands

**Start Hardhat Node:**
```powershell
npx hardhat node
```

**Deploy Contracts:**
```powershell
npx hardhat run scripts/deployV2.js --network localhost
```

**Run Tests:**
```powershell
npx hardhat test
```

**Compile Contracts:**
```powershell
npx hardhat compile
```

## 🎮 Using the Application

### Create a DID:
1. Go to "Identity Management" tab
2. Enter DID identifier (e.g., `did:ethr:0xYourAddress`)
3. Add verification method
4. Click "Create DID"

### Issue Credentials:
1. Go to "Credentials" tab
2. Click "Add New Credential"
3. Fill in details
4. Click "Issue Credential"

### Verify Credentials:
1. Go to "Verification" tab
2. Enter credential ID
3. Click "Verify"

---

**Your project is almost ready! Just complete Steps 1-5 above and you're good to go!** 🎉
