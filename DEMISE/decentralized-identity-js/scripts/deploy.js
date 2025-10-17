// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  // Get signers (accounts)
  const [deployer, user1, user2] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1️⃣ Deploy IdentityRegistry
  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.deployed();
  console.log("IdentityRegistry deployed at:", identityRegistry.address);

  // 2️⃣ Deploy CredentialRegistry
  const CredentialRegistry = await hre.ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy();
  await credentialRegistry.deployed();
  console.log("CredentialRegistry deployed at:", credentialRegistry.address);

  // 3️⃣ Register DID for user1
  const didHash = "QmFakeHashForUser1"; // placeholder for actual DID hash
  let tx = await identityRegistry.registerIdentity(user1.address, didHash);
  await tx.wait();
  console.log(`Registered DID for user1: ${didHash}`);

  // 4️⃣ Issue credential to user1
  const credentialHash = "QmFakeCredentialHash";
  tx = await credentialRegistry.connect(deployer).issueCredential(user1.address, credentialHash);
  await tx.wait();
  console.log(`Issued credential to user1: ${credentialHash}`);

  // 5️⃣ Verify credential
  const isValid = await credentialRegistry.verifyCredential(0);
  console.log("Credential 0 valid?", isValid);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
