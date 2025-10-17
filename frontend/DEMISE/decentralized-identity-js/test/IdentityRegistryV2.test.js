const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("IdentityRegistryV2", function () {
  async function deployIdentityRegistryFixture() {
    const [owner, user1, user2, unauthorized] = await ethers.getSigners();

    const IdentityRegistryV2 = await ethers.getContractFactory("IdentityRegistryV2");
    const identityRegistry = await IdentityRegistryV2.deploy();
    await identityRegistry.deployed();

    // Initialize the contract
    await identityRegistry.initialize();

    return { identityRegistry, owner, user1, user2, unauthorized };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { identityRegistry, owner } = await loadFixture(deployIdentityRegistryFixture);
      expect(await identityRegistry.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero DIDs", async function () {
      const { identityRegistry } = await loadFixture(deployIdentityRegistryFixture);
      expect(await identityRegistry.getTotalDIDs()).to.equal(0);
    });
  });

  describe("DID Creation", function () {
    it("Should create a DID successfully", async function () {
      const { identityRegistry, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await expect(identityRegistry.connect(user1).createDID(did, context, verificationMethod))
        .to.emit(identityRegistry, "DIDCreated")
        .withArgs(user1.address, did, await ethers.provider.getBlock("latest").then(b => b.timestamp));

      expect(await identityRegistry.hasActiveDID(user1.address)).to.be.true;
      expect(await identityRegistry.getTotalDIDs()).to.equal(1);
    });

    it("Should reject empty DID", async function () {
      const { identityRegistry, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await expect(identityRegistry.connect(user1).createDID("", context, verificationMethod))
        .to.be.revertedWith("DID cannot be empty");
    });

    it("Should reject duplicate DID", async function () {
      const { identityRegistry, user1, user2 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await identityRegistry.connect(user1).createDID(did, context, verificationMethod);
      
      await expect(identityRegistry.connect(user2).createDID(did, context, verificationMethod))
        .to.be.revertedWith("DID already exists");
    });

    it("Should reject second DID for same address", async function () {
      const { identityRegistry, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did1 = "did:ethr:0x1234567890123456789012345678901234567890";
      const did2 = "did:ethr:0x0987654321098765432109876543210987654321";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await identityRegistry.connect(user1).createDID(did1, context, verificationMethod);
      
      await expect(identityRegistry.connect(user1).createDID(did2, context, verificationMethod))
        .to.be.revertedWith("Address already has DID");
    });
  });

  describe("DID Resolution", function () {
    it("Should resolve DID by address", async function () {
      const { identityRegistry, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await identityRegistry.connect(user1).createDID(did, context, verificationMethod);
      
      const resolvedDID = await identityRegistry.resolveDID(user1.address);
      expect(resolvedDID.id).to.equal(did);
      expect(resolvedDID.active).to.be.true;
    });

    it("Should resolve DID by identifier", async function () {
      const { identityRegistry, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await identityRegistry.connect(user1).createDID(did, context, verificationMethod);
      
      const resolvedDID = await identityRegistry.resolveDIDById(did);
      expect(resolvedDID.id).to.equal(did);
      expect(resolvedDID.active).to.be.true;
    });

    it("Should reject resolution of non-existent DID", async function () {
      const { identityRegistry, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      await expect(identityRegistry.resolveDID(user1.address))
        .to.be.revertedWith("DID not found");
    });
  });

  describe("DID Updates", function () {
    it("Should update DID successfully", async function () {
      const { identityRegistry, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await identityRegistry.connect(user1).createDID(did, context, verificationMethod);
      
      const newContext = ["https://www.w3.org/ns/did/v1", "https://example.com/context"];
      const newVerificationMethod = [
        "did:ethr:0x1234567890123456789012345678901234567890#key-1",
        "did:ethr:0x1234567890123456789012345678901234567890#key-2"
      ];

      await expect(identityRegistry.connect(user1).updateDID(did, newContext, newVerificationMethod))
        .to.emit(identityRegistry, "DIDUpdated")
        .withArgs(user1.address, did, await ethers.provider.getBlock("latest").then(b => b.timestamp));

      const updatedDID = await identityRegistry.resolveDID(user1.address);
      expect(updatedDID.context.length).to.equal(2);
      expect(updatedDID.verificationMethod.length).to.equal(2);
    });

    it("Should reject update by non-owner", async function () {
      const { identityRegistry, user1, user2 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await identityRegistry.connect(user1).createDID(did, context, verificationMethod);
      
      await expect(identityRegistry.connect(user2).updateDID(did, context, verificationMethod))
        .to.be.revertedWith("Not DID owner");
    });
  });

  describe("DID Deactivation", function () {
    it("Should deactivate DID successfully", async function () {
      const { identityRegistry, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await identityRegistry.connect(user1).createDID(did, context, verificationMethod);
      
      await expect(identityRegistry.connect(user1).deactivateDID(did))
        .to.emit(identityRegistry, "DIDDeactivated")
        .withArgs(user1.address, did, await ethers.provider.getBlock("latest").then(b => b.timestamp));

      const deactivatedDID = await identityRegistry.resolveDID(user1.address);
      expect(deactivatedDID.active).to.be.false;
    });

    it("Should reject deactivation by non-owner", async function () {
      const { identityRegistry, user1, user2 } = await loadFixture(deployIdentityRegistryFixture);
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await identityRegistry.connect(user1).createDID(did, context, verificationMethod);
      
      await expect(identityRegistry.connect(user2).deactivateDID(did))
        .to.be.revertedWith("Not DID owner");
    });
  });

  describe("Pause Functionality", function () {
    it("Should pause and unpause correctly", async function () {
      const { identityRegistry, owner } = await loadFixture(deployIdentityRegistryFixture);
      
      await identityRegistry.connect(owner).pause();
      expect(await identityRegistry.paused()).to.be.true;
      
      await identityRegistry.connect(owner).unpause();
      expect(await identityRegistry.paused()).to.be.false;
    });

    it("Should reject operations when paused", async function () {
      const { identityRegistry, owner, user1 } = await loadFixture(deployIdentityRegistryFixture);
      
      await identityRegistry.connect(owner).pause();
      
      const did = "did:ethr:0x1234567890123456789012345678901234567890";
      const context = ["https://www.w3.org/ns/did/v1"];
      const verificationMethod = ["did:ethr:0x1234567890123456789012345678901234567890#key-1"];

      await expect(identityRegistry.connect(user1).createDID(did, context, verificationMethod))
        .to.be.revertedWith("Pausable: paused");
    });
  });
});