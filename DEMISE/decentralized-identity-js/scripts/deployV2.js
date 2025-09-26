const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Starting Advanced DID System Deployment...\n");

  // Get signers
  const [deployer, issuer1, issuer2, user1, user2] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy implementation contracts
  console.log("\n📦 Deploying Implementation Contracts...");
  
  const IdentityRegistryV2 = await hre.ethers.getContractFactory("IdentityRegistryV2");
  const identityRegistryImpl = await IdentityRegistryV2.deploy();
  await identityRegistryImpl.deployed();
  console.log("✅ IdentityRegistryV2 Implementation deployed at:", identityRegistryImpl.address);

  const CredentialRegistryV2 = await hre.ethers.getContractFactory("CredentialRegistryV2");
  const credentialRegistryImpl = await CredentialRegistryV2.deploy();
  await credentialRegistryImpl.deployed();
  console.log("✅ CredentialRegistryV2 Implementation deployed at:", credentialRegistryImpl.address);

  // Deploy proxy contracts
  console.log("\n🔗 Deploying Proxy Contracts...");
  
  const IdentityRegistryProxy = await hre.ethers.getContractFactory("IdentityRegistryProxy");
  const identityRegistry = await IdentityRegistryProxy.deploy(
    identityRegistryImpl.address,
    identityRegistryImpl.interface.encodeFunctionData("initialize")
  );
  await identityRegistry.deployed();
  console.log("✅ IdentityRegistry Proxy deployed at:", identityRegistry.address);

  const CredentialRegistryProxy = await hre.ethers.getContractFactory("CredentialRegistryProxy");
  const credentialRegistry = await CredentialRegistryProxy.deploy(
    credentialRegistryImpl.address,
    credentialRegistryImpl.interface.encodeFunctionData("initialize")
  );
  await credentialRegistry.deployed();
  console.log("✅ CredentialRegistry Proxy deployed at:", credentialRegistry.address);

  // Initialize contracts
  console.log("\n⚙️ Initializing Contracts...");
  
  // Authorize issuers
  await credentialRegistry.authorizeIssuer(issuer1.address, "did:ethr:issuer1");
  await credentialRegistry.authorizeIssuer(issuer2.address, "did:ethr:issuer2");
  console.log("✅ Authorized issuers:", issuer1.address, issuer2.address);

  // Add support for additional credential types
  await credentialRegistry.setCredentialTypeSupport("KYC", true);
  await credentialRegistry.setCredentialTypeSupport("AML", true);
  console.log("✅ Added support for additional credential types");

  // Demonstrate the complete flow
  console.log("\n🎯 Demonstrating Complete DID Flow...");

  // 1. Create DIDs for users
  console.log("\n1️⃣ Creating DIDs...");
  
  const user1DID = "did:ethr:user1";
  const user1Context = ["https://www.w3.org/ns/did/v1"];
  const user1VerificationMethod = ["did:ethr:user1#key-1"];
  
  await identityRegistry.connect(user1).createDID(user1DID, user1Context, user1VerificationMethod);
  console.log("✅ Created DID for user1:", user1DID);

  const user2DID = "did:ethr:user2";
  const user2Context = ["https://www.w3.org/ns/did/v1"];
  const user2VerificationMethod = ["did:ethr:user2#key-1"];
  
  await identityRegistry.connect(user2).createDID(user2DID, user2Context, user2VerificationMethod);
  console.log("✅ Created DID for user2:", user2DID);

  // 2. Issue credentials
  console.log("\n2️⃣ Issuing Credentials...");
  
  // Educational credential
  const eduClaimKeys = ["name", "degree", "university", "graduationYear"];
  const eduClaimValues = ["Alice Johnson", "Bachelor of Computer Science", "MIT", "2023"];
  const eduExpiration = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year
  
  await credentialRegistry.connect(issuer1).issueCredential(
    user1DID,
    "EducationalCredential",
    eduClaimKeys,
    eduClaimValues,
    eduExpiration,
    "https://example.com/education-schema",
    true
  );
  console.log("✅ Issued educational credential to user1");

  // Professional credential
  const profClaimKeys = ["name", "profession", "licenseNumber", "issuingAuthority"];
  const profClaimValues = ["Bob Smith", "Software Engineer", "SE-12345", "State Board"];
  const profExpiration = Math.floor(Date.now() / 1000) + 730 * 24 * 60 * 60; // 2 years
  
  await credentialRegistry.connect(issuer2).issueCredential(
    user2DID,
    "ProfessionalCredential",
    profClaimKeys,
    profClaimValues,
    profExpiration,
    "https://example.com/professional-schema",
    true
  );
  console.log("✅ Issued professional credential to user2");

  // KYC credential with ZK proof
  const kycZkProof = "zk-proof-kyc-data-here";
  const kycExpiration = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60; // 6 months
  
  await credentialRegistry.connect(issuer1).issueCredentialWithZKProof(
    user1DID,
    "KYC",
    kycZkProof,
    kycExpiration
  );
  console.log("✅ Issued KYC credential with ZK proof to user1");

  // 3. Verify credentials
  console.log("\n3️⃣ Verifying Credentials...");
  
  const isEduCredValid = await credentialRegistry.verifyCredential(0);
  const isProfCredValid = await credentialRegistry.verifyCredential(1);
  const isKycCredValid = await credentialRegistry.verifyCredential(2);
  
  console.log("✅ Educational credential valid:", isEduCredValid);
  console.log("✅ Professional credential valid:", isProfCredValid);
  console.log("✅ KYC credential valid:", isKycCredValid);

  // 4. Demonstrate credential queries
  console.log("\n4️⃣ Querying Credential Data...");
  
  const eduCredential = await credentialRegistry.getCredential(0);
  console.log("📋 Educational Credential Details:");
  console.log("   - ID:", eduCredential.id);
  console.log("   - Type:", eduCredential.type);
  console.log("   - Issuer:", eduCredential.issuer);
  console.log("   - Subject:", eduCredential.subject);
  console.log("   - Status:", eduCredential.credentialStatus);
  console.log("   - Selective Disclosure:", eduCredential.selectiveDisclosure);

  const eduClaims = await credentialRegistry.getAllCredentialClaims(0);
  console.log("📋 Educational Credential Claims:");
  for (let i = 0; i < eduClaims[0].length; i++) {
    console.log(`   - ${eduClaims[0][i]}: ${eduClaims[1][i]}`);
  }

  // 5. Demonstrate DID resolution
  console.log("\n5️⃣ Resolving DIDs...");
  
  const user1DIDDoc = await identityRegistry.resolveDID(user1.address);
  console.log("📋 User1 DID Document:");
  console.log("   - ID:", user1DIDDoc.id);
  console.log("   - Active:", user1DIDDoc.active);
  console.log("   - Created:", new Date(user1DIDDoc.created * 1000).toISOString());
  console.log("   - Updated:", new Date(user1DIDDoc.updated * 1000).toISOString());

  // 6. Demonstrate credential management
  console.log("\n6️⃣ Demonstrating Credential Management...");
  
  // Suspend a credential
  await credentialRegistry.connect(issuer1).suspendCredential(0, "Under review");
  console.log("⏸️ Suspended educational credential");
  
  const isEduCredValidAfterSuspension = await credentialRegistry.verifyCredential(0);
  console.log("✅ Educational credential valid after suspension:", isEduCredValidAfterSuspension);
  
  // Reactivate the credential
  await credentialRegistry.connect(issuer1).reactivateCredential(0);
  console.log("▶️ Reactivated educational credential");
  
  const isEduCredValidAfterReactivation = await credentialRegistry.verifyCredential(0);
  console.log("✅ Educational credential valid after reactivation:", isEduCredValidAfterReactivation);

  // 7. Demonstrate DID updates
  console.log("\n7️⃣ Demonstrating DID Updates...");
  
  const updatedContext = ["https://www.w3.org/ns/did/v1", "https://example.com/context"];
  const updatedVerificationMethod = [
    "did:ethr:user1#key-1",
    "did:ethr:user1#key-2"
  ];
  
  await identityRegistry.connect(user1).updateDID(user1DID, updatedContext, updatedVerificationMethod);
  console.log("✅ Updated user1 DID document");

  // 8. Get system statistics
  console.log("\n8️⃣ System Statistics...");
  
  const totalDIDs = await identityRegistry.getTotalDIDs();
  const totalCredentials = await credentialRegistry.getTotalCredentials();
  
  console.log("📊 System Statistics:");
  console.log("   - Total DIDs:", totalDIDs.toString());
  console.log("   - Total Credentials:", totalCredentials.toString());

  // Save deployment information
  const deploymentInfo = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      identityRegistryImpl: identityRegistryImpl.address,
      credentialRegistryImpl: credentialRegistryImpl.address,
      identityRegistry: identityRegistry.address,
      credentialRegistry: credentialRegistry.address
    },
    issuers: {
      issuer1: {
        address: issuer1.address,
        did: "did:ethr:issuer1"
      },
      issuer2: {
        address: issuer2.address,
        did: "did:ethr:issuer2"
      }
    },
    users: {
      user1: {
        address: user1.address,
        did: user1DID
      },
      user2: {
        address: user2.address,
        did: user2DID
      }
    }
  };

  fs.writeFileSync(
    `deployment-${hre.network.name}-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n🎉 Deployment completed successfully!");
  console.log("📄 Deployment info saved to deployment file");
  console.log("\n🔗 Contract Addresses:");
  console.log("   - IdentityRegistry:", identityRegistry.address);
  console.log("   - CredentialRegistry:", credentialRegistry.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });