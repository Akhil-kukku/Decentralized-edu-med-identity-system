const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Advanced DID System Integration Tests", function () {
  async function deployCompleteSystemFixture() {
    const [owner, issuer1, issuer2, user1, user2, user3] = await ethers.getSigners();

    // Deploy implementation contracts
    const IdentityRegistryV2 = await ethers.getContractFactory("IdentityRegistryV2");
    const identityRegistryImpl = await IdentityRegistryV2.deploy();
    await identityRegistryImpl.deployed();

    const CredentialRegistryV2 = await ethers.getContractFactory("CredentialRegistryV2");
    const credentialRegistryImpl = await CredentialRegistryV2.deploy();
    await credentialRegistryImpl.deployed();

    // Deploy proxy contracts
    const IdentityRegistryProxy = await ethers.getContractFactory("IdentityRegistryProxy");
    const identityRegistry = await IdentityRegistryProxy.deploy(
      identityRegistryImpl.address,
      identityRegistryImpl.interface.encodeFunctionData("initialize")
    );
    await identityRegistry.deployed();

    const CredentialRegistryProxy = await ethers.getContractFactory("CredentialRegistryProxy");
    const credentialRegistry = await CredentialRegistryProxy.deploy(
      credentialRegistryImpl.address,
      credentialRegistryImpl.interface.encodeFunctionData("initialize")
    );
    await credentialRegistry.deployed();

    // Authorize issuers
    await credentialRegistry.authorizeIssuer(issuer1.address, "did:ethr:issuer1");
    await credentialRegistry.authorizeIssuer(issuer2.address, "did:ethr:issuer2");

    // Add support for additional credential types
    await credentialRegistry.setCredentialTypeSupport("KYC", true);
    await credentialRegistry.setCredentialTypeSupport("AML", true);

    return {
      identityRegistry,
      credentialRegistry,
      owner,
      issuer1,
      issuer2,
      user1,
      user2,
      user3
    };
  }

  describe("Complete DID and Credential Lifecycle", function () {
    it("Should handle complete user journey from DID creation to credential verification", async function () {
      const { identityRegistry, credentialRegistry, issuer1, user1 } = await loadFixture(deployCompleteSystemFixture);

      // Step 1: User creates a DID
      const userDID = "did:ethr:user1";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:user1#key-1"];

      await identityRegistry.connect(user1).createDID(userDID, context, verificationMethod);
      
      const didDoc = await identityRegistry.resolveDID(user1.address);
      expect(didDoc.id).to.equal(userDID);
      expect(didDoc.active).to.be.true;

      // Step 2: Issuer issues multiple credentials
      const eduClaimKeys = ["name", "degree", "university", "graduationYear"];
      const eduClaimValues = ["Alice Johnson", "Bachelor of Computer Science", "MIT", "2023"];
      const eduExpiration = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

      await credentialRegistry.connect(issuer1).issueCredential(
        userDID,
        "EducationalCredential",
        eduClaimKeys,
        eduClaimValues,
        eduExpiration,
        "https://example.com/education-schema",
        true
      );

      const profClaimKeys = ["name", "profession", "company", "yearsExperience"];
      const profClaimValues = ["Alice Johnson", "Software Engineer", "Tech Corp", "5"];
      const profExpiration = Math.floor(Date.now() / 1000) + 730 * 24 * 60 * 60;

      await credentialRegistry.connect(issuer1).issueCredential(
        userDID,
        "ProfessionalCredential",
        profClaimKeys,
        profClaimValues,
        profExpiration,
        "https://example.com/professional-schema",
        true
      );

      // Step 3: Issue KYC credential with ZK proof
      const kycZkProof = "zk-proof-kyc-data-here";
      const kycExpiration = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60;

      await credentialRegistry.connect(issuer1).issueCredentialWithZKProof(
        userDID,
        "KYC",
        kycZkProof,
        kycExpiration
      );

      // Step 4: Verify all credentials
      const eduValid = await credentialRegistry.verifyCredential(0);
      const profValid = await credentialRegistry.verifyCredential(1);
      const kycValid = await credentialRegistry.verifyCredential(2);

      expect(eduValid).to.be.true;
      expect(profValid).to.be.true;
      expect(kycValid).to.be.true;

      // Step 5: Query credential details
      const eduCredential = await credentialRegistry.getCredential(0);
      expect(eduCredential.subject).to.equal(userDID);
      expect(eduCredential.issuer).to.equal("did:ethr:issuer1");
      expect(eduCredential.credentialStatus).to.equal("active");

      // Step 6: Get all claims for educational credential
      const [claimKeys, claimValues] = await credentialRegistry.getAllCredentialClaims(0);
      expect(claimKeys).to.deep.equal(eduClaimKeys);
      expect(claimValues).to.deep.equal(eduClaimValues);

      // Step 7: Get user's credentials
      const userCredentials = await credentialRegistry.getSubjectCredentials(userDID);
      expect(userCredentials.length).to.equal(3);
      expect(userCredentials[0]).to.equal(0);
      expect(userCredentials[1]).to.equal(1);
      expect(userCredentials[2]).to.equal(2);

      // Step 8: Demonstrate credential management
      await credentialRegistry.connect(issuer1).suspendCredential(0, "Under review");
      const eduValidAfterSuspension = await credentialRegistry.verifyCredential(0);
      expect(eduValidAfterSuspension).to.be.false;

      await credentialRegistry.connect(issuer1).reactivateCredential(0);
      const eduValidAfterReactivation = await credentialRegistry.verifyCredential(0);
      expect(eduValidAfterReactivation).to.be.true;

      // Step 9: Update DID
      const updatedContext = ["https://www.w3.org/ns/did/v1", "https://example.com/context"];
      const updatedVerificationMethod = ["did:ethr:user1#key-1", "did:ethr:user1#key-2"];

      await identityRegistry.connect(user1).updateDID(userDID, updatedContext, updatedVerificationMethod);
      
      const updatedDIDDoc = await identityRegistry.resolveDID(user1.address);
      expect(updatedDIDDoc.context.length).to.equal(2);
      expect(updatedDIDDoc.verificationMethod.length).to.equal(2);

      // Step 10: Deactivate DID
      await identityRegistry.connect(user1).deactivateDID(userDID);
      
      const deactivatedDIDDoc = await identityRegistry.resolveDID(user1.address);
      expect(deactivatedDIDDoc.active).to.be.false;
    });

    it("Should handle multiple users with different credential types", async function () {
      const { identityRegistry, credentialRegistry, issuer1, issuer2, user1, user2, user3 } = await loadFixture(deployCompleteSystemFixture);

      // Create DIDs for all users
      const user1DID = "did:ethr:user1";
      const user2DID = "did:ethr:user2";
      const user3DID = "did:ethr:user3";

      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:user1#key-1"];

      await identityRegistry.connect(user1).createDID(user1DID, context, verificationMethod);
      await identityRegistry.connect(user2).createDID(user2DID, context, verificationMethod);
      await identityRegistry.connect(user3).createDID(user3DID, context, verificationMethod);

      // Issue different types of credentials
      // User1: Educational + Professional
      await credentialRegistry.connect(issuer1).issueCredential(
        user1DID,
        "EducationalCredential",
        ["name", "degree"],
        ["Alice", "Bachelor"],
        0,
        "https://example.com/schema",
        true
      );

      await credentialRegistry.connect(issuer1).issueCredential(
        user1DID,
        "ProfessionalCredential",
        ["name", "profession"],
        ["Alice", "Engineer"],
        0,
        "https://example.com/schema",
        true
      );

      // User2: KYC + AML
      await credentialRegistry.connect(issuer2).issueCredentialWithZKProof(
        user2DID,
        "KYC",
        "zk-proof-kyc",
        0
      );

      await credentialRegistry.connect(issuer2).issueCredentialWithZKProof(
        user2DID,
        "AML",
        "zk-proof-aml",
        0
      );

      // User3: Mixed credentials from both issuers
      await credentialRegistry.connect(issuer1).issueCredential(
        user3DID,
        "EducationalCredential",
        ["name", "degree"],
        ["Charlie", "Master"],
        0,
        "https://example.com/schema",
        true
      );

      await credentialRegistry.connect(issuer2).issueCredentialWithZKProof(
        user3DID,
        "KYC",
        "zk-proof-kyc-charlie",
        0
      );

      // Verify all credentials are valid
      expect(await credentialRegistry.verifyCredential(0)).to.be.true; // User1 Edu
      expect(await credentialRegistry.verifyCredential(1)).to.be.true; // User1 Prof
      expect(await credentialRegistry.verifyCredential(2)).to.be.true; // User2 KYC
      expect(await credentialRegistry.verifyCredential(3)).to.be.true; // User2 AML
      expect(await credentialRegistry.verifyCredential(4)).to.be.true; // User3 Edu
      expect(await credentialRegistry.verifyCredential(5)).to.be.true; // User3 KYC

      // Check user credential counts
      const user1Credentials = await credentialRegistry.getSubjectCredentials(user1DID);
      const user2Credentials = await credentialRegistry.getSubjectCredentials(user2DID);
      const user3Credentials = await credentialRegistry.getSubjectCredentials(user3DID);

      expect(user1Credentials.length).to.equal(2);
      expect(user2Credentials.length).to.equal(2);
      expect(user3Credentials.length).to.equal(2);

      // Check total system statistics
      const totalDIDs = await identityRegistry.getTotalDIDs();
      const totalCredentials = await credentialRegistry.getTotalCredentials();

      expect(totalDIDs).to.equal(3);
      expect(totalCredentials).to.equal(6);
    });

    it("Should handle credential expiration and renewal", async function () {
      const { identityRegistry, credentialRegistry, issuer1, user1 } = await loadFixture(deployCompleteSystemFixture);

      const userDID = "did:ethr:user1";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:user1#key-1"];

      await identityRegistry.connect(user1).createDID(userDID, context, verificationMethod);

      // Issue credential with short expiration
      const shortExpiration = Math.floor(Date.now() / 1000) + 60; // 1 minute
      
      await credentialRegistry.connect(issuer1).issueCredential(
        userDID,
        "EducationalCredential",
        ["name", "degree"],
        ["Alice", "Bachelor"],
        shortExpiration,
        "https://example.com/schema",
        true
      );

      // Credential should be valid initially
      expect(await credentialRegistry.verifyCredential(0)).to.be.true;

      // Fast forward time to after expiration
      await ethers.provider.send("evm_increaseTime", [120]); // 2 minutes
      await ethers.provider.send("evm_mine", []);

      // Credential should now be invalid due to expiration
      expect(await credentialRegistry.verifyCredential(0)).to.be.false;

      // Issue renewed credential
      const newExpiration = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year
      
      await credentialRegistry.connect(issuer1).issueCredential(
        userDID,
        "EducationalCredential",
        ["name", "degree", "renewalDate"],
        ["Alice", "Bachelor", new Date().toISOString()],
        newExpiration,
        "https://example.com/schema",
        true
      );

      // New credential should be valid
      expect(await credentialRegistry.verifyCredential(1)).to.be.true;
    });

    it("Should handle bulk operations efficiently", async function () {
      const { identityRegistry, credentialRegistry, issuer1, user1 } = await loadFixture(deployCompleteSystemFixture);

      const userDID = "did:ethr:user1";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:user1#key-1"];

      await identityRegistry.connect(user1).createDID(userDID, context, verificationMethod);

      // Issue multiple credentials in sequence
      const credentialCount = 10;
      const promises = [];

      for (let i = 0; i < credentialCount; i++) {
        const promise = credentialRegistry.connect(issuer1).issueCredential(
          userDID,
          "EducationalCredential",
          ["name", "course"],
          [`Alice${i}`, `Course${i}`],
          0,
          "https://example.com/schema",
          true
        );
        promises.push(promise);
      }

      // Wait for all credentials to be issued
      await Promise.all(promises);

      // Verify all credentials
      const userCredentials = await credentialRegistry.getSubjectCredentials(userDID);
      expect(userCredentials.length).to.equal(credentialCount);

      // All credentials should be valid
      for (let i = 0; i < credentialCount; i++) {
        expect(await credentialRegistry.verifyCredential(i)).to.be.true;
      }

      // Test bulk suspension
      for (let i = 0; i < credentialCount; i += 2) {
        await credentialRegistry.connect(issuer1).suspendCredential(i, "Bulk suspension");
      }

      // Check that every other credential is suspended
      for (let i = 0; i < credentialCount; i++) {
        const isValid = await credentialRegistry.verifyCredential(i);
        expect(isValid).to.equal(i % 2 === 1); // Odd indices should be valid
      }
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should handle invalid operations gracefully", async function () {
      const { identityRegistry, credentialRegistry, issuer1, user1, unauthorized } = await loadFixture(deployCompleteSystemFixture);

      // Try to create DID with empty identifier
      await expect(
        identityRegistry.connect(user1).createDID("", ["https://www.w3.org/ns/did/v1"], ["did:ethr:user1#key-1"])
      ).to.be.revertedWith("DID cannot be empty");

      // Try to issue credential without authorization
      await expect(
        credentialRegistry.connect(unauthorized).issueCredential(
          "did:ethr:user1",
          "EducationalCredential",
          ["name"],
          ["Alice"],
          0,
          "https://example.com/schema",
          true
        )
      ).to.be.revertedWith("Not authorized issuer");

      // Try to verify non-existent credential
      await expect(
        credentialRegistry.verifyCredential(999)
      ).to.be.revertedWith("Invalid credential ID");

      // Try to resolve non-existent DID
      await expect(
        identityRegistry.resolveDID(user1.address)
      ).to.be.revertedWith("DID not found");
    });

    it("Should handle contract pausing correctly", async function () {
      const { identityRegistry, credentialRegistry, issuer1, user1, owner } = await loadFixture(deployCompleteSystemFixture);

      // Pause both contracts
      await identityRegistry.connect(owner).pause();
      await credentialRegistry.connect(owner).pause();

      // Try to create DID when paused
      await expect(
        identityRegistry.connect(user1).createDID(
          "did:ethr:user1",
          ["https://www.w3.org/ns/did/v1"],
          ["did:ethr:user1#key-1"]
        )
      ).to.be.revertedWith("Pausable: paused");

      // Try to issue credential when paused
      await expect(
        credentialRegistry.connect(issuer1).issueCredential(
          "did:ethr:user1",
          "EducationalCredential",
          ["name"],
          ["Alice"],
          0,
          "https://example.com/schema",
          true
        )
      ).to.be.revertedWith("Pausable: paused");

      // Unpause contracts
      await identityRegistry.connect(owner).unpause();
      await credentialRegistry.connect(owner).unpause();

      // Operations should work again
      await identityRegistry.connect(user1).createDID(
        "did:ethr:user1",
        ["https://www.w3.org/ns/did/v1"],
        ["did:ethr:user1#key-1"]
      );

      await credentialRegistry.connect(issuer1).issueCredential(
        "did:ethr:user1",
        "EducationalCredential",
        ["name"],
        ["Alice"],
        0,
        "https://example.com/schema",
        true
      );
    });
  });
});

