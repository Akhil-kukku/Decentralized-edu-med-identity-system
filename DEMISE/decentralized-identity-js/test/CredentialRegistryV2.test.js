const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CredentialRegistryV2", function () {
  async function deployCredentialRegistryFixture() {
    const [owner, issuer1, issuer2, subject1, subject2, unauthorized] = await ethers.getSigners();

    const CredentialRegistryV2 = await ethers.getContractFactory("CredentialRegistryV2");
    const credentialRegistry = await CredentialRegistryV2.deploy();
    await credentialRegistry.deployed();

    // Initialize the contract
    await credentialRegistry.initialize();

    // Authorize issuers
    await credentialRegistry.authorizeIssuer(issuer1.address, "did:ethr:issuer1");
    await credentialRegistry.authorizeIssuer(issuer2.address, "did:ethr:issuer2");

    return { credentialRegistry, owner, issuer1, issuer2, subject1, subject2, unauthorized };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { credentialRegistry, owner } = await loadFixture(deployCredentialRegistryFixture);
      expect(await credentialRegistry.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero credentials", async function () {
      const { credentialRegistry } = await loadFixture(deployCredentialRegistryFixture);
      expect(await credentialRegistry.getTotalCredentials()).to.equal(0);
    });

    it("Should support common credential types", async function () {
      const { credentialRegistry } = await loadFixture(deployCredentialRegistryFixture);
      expect(await credentialRegistry.supportedCredentialTypes("VerifiableCredential")).to.be.true;
      expect(await credentialRegistry.supportedCredentialTypes("EducationalCredential")).to.be.true;
    });
  });

  describe("Issuer Management", function () {
    it("Should authorize issuer successfully", async function () {
      const { credentialRegistry, owner, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      await expect(credentialRegistry.connect(owner).authorizeIssuer(issuer1.address, "did:ethr:issuer1"))
        .to.emit(credentialRegistry, "IssuerAuthorized")
        .withArgs(issuer1.address, "did:ethr:issuer1");

      expect(await credentialRegistry.authorizedIssuers(issuer1.address)).to.be.true;
      expect(await credentialRegistry.issuerDIDs(issuer1.address)).to.equal("did:ethr:issuer1");
    });

    it("Should deauthorize issuer successfully", async function () {
      const { credentialRegistry, owner, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      await credentialRegistry.connect(owner).deauthorizeIssuer(issuer1.address);
      
      expect(await credentialRegistry.authorizedIssuers(issuer1.address)).to.be.false;
    });

    it("Should reject unauthorized issuer operations", async function () {
      const { credentialRegistry, unauthorized, subject1 } = await loadFixture(deployCredentialRegistryFixture);
      
      const claimKeys = ["name", "degree"];
      const claimValues = ["John Doe", "Bachelor of Science"];
      
      await expect(
        credentialRegistry.connect(unauthorized).issueCredential(
          "did:ethr:subject1",
          "EducationalCredential",
          claimKeys,
          claimValues,
          0,
          "https://example.com/schema",
          true
        )
      ).to.be.revertedWith("Not authorized issuer");
    });
  });

  describe("Credential Issuance", function () {
    it("Should issue credential successfully", async function () {
      const { credentialRegistry, issuer1, subject1 } = await loadFixture(deployCredentialRegistryFixture);
      
      const subject = "did:ethr:subject1";
      const credentialType = "EducationalCredential";
      const claimKeys = ["name", "degree", "university"];
      const claimValues = ["John Doe", "Bachelor of Science", "MIT"];
      const expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year
      const credentialSchema = "https://example.com/education-schema";
      
      await expect(
        credentialRegistry.connect(issuer1).issueCredential(
          subject,
          credentialType,
          claimKeys,
          claimValues,
          expirationDate,
          credentialSchema,
          true
        )
      ).to.emit(credentialRegistry, "CredentialIssued")
        .withArgs(0, "did:ethr:issuer1", subject, credentialType);

      expect(await credentialRegistry.getTotalCredentials()).to.equal(1);
      expect(await credentialRegistry.verifyCredential(0)).to.be.true;
    });

    it("Should issue credential with ZK proof", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      const subject = "did:ethr:subject1";
      const credentialType = "IdentityCredential";
      const zkProof = "zk-proof-data-here";
      const expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      
      await expect(
        credentialRegistry.connect(issuer1).issueCredentialWithZKProof(
          subject,
          credentialType,
          zkProof,
          expirationDate
        )
      ).to.emit(credentialRegistry, "CredentialIssued")
        .withArgs(0, "did:ethr:issuer1", subject, credentialType);

      const credential = await credentialRegistry.getCredential(0);
      expect(credential.zkProof).to.equal(zkProof);
      expect(credential.selectiveDisclosure).to.be.true;
    });

    it("Should reject unsupported credential type", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      const claimKeys = ["name"];
      const claimValues = ["John Doe"];
      
      await expect(
        credentialRegistry.connect(issuer1).issueCredential(
          "did:ethr:subject1",
          "UnsupportedCredential",
          claimKeys,
          claimValues,
          0,
          "https://example.com/schema",
          true
        )
      ).to.be.revertedWith("Unsupported credential type");
    });

    it("Should reject empty subject", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      const claimKeys = ["name"];
      const claimValues = ["John Doe"];
      
      await expect(
        credentialRegistry.connect(issuer1).issueCredential(
          "",
          "EducationalCredential",
          claimKeys,
          claimValues,
          0,
          "https://example.com/schema",
          true
        )
      ).to.be.revertedWith("Subject cannot be empty");
    });
  });

  describe("Credential Management", function () {
    async function issueTestCredential(credentialRegistry, issuer, subject) {
      const claimKeys = ["name", "degree"];
      const claimValues = ["John Doe", "Bachelor of Science"];
      
      await credentialRegistry.connect(issuer).issueCredential(
        subject,
        "EducationalCredential",
        claimKeys,
        claimValues,
        0,
        "https://example.com/schema",
        true
      );
    }

    it("Should revoke credential successfully", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      await issueTestCredential(credentialRegistry, issuer1, "did:ethr:subject1");
      
      await expect(credentialRegistry.connect(issuer1).revokeCredential(0, "Credential compromised"))
        .to.emit(credentialRegistry, "CredentialRevoked")
        .withArgs(0, "Credential compromised");

      expect(await credentialRegistry.verifyCredential(0)).to.be.false;
    });

    it("Should suspend credential successfully", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      await issueTestCredential(credentialRegistry, issuer1, "did:ethr:subject1");
      
      await expect(credentialRegistry.connect(issuer1).suspendCredential(0, "Under investigation"))
        .to.emit(credentialRegistry, "CredentialSuspended")
        .withArgs(0, "Under investigation");

      expect(await credentialRegistry.verifyCredential(0)).to.be.false;
    });

    it("Should reactivate suspended credential", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      await issueTestCredential(credentialRegistry, issuer1, "did:ethr:subject1");
      await credentialRegistry.connect(issuer1).suspendCredential(0, "Under investigation");
      
      await expect(credentialRegistry.connect(issuer1).reactivateCredential(0))
        .to.emit(credentialRegistry, "CredentialReactivated")
        .withArgs(0);

      expect(await credentialRegistry.verifyCredential(0)).to.be.true;
    });

    it("Should reject operations by unauthorized users", async function () {
      const { credentialRegistry, issuer1, unauthorized } = await loadFixture(deployCredentialRegistryFixture);
      
      await issueTestCredential(credentialRegistry, issuer1, "did:ethr:subject1");
      
      await expect(credentialRegistry.connect(unauthorized).revokeCredential(0, "Unauthorized"))
        .to.be.revertedWith("Not authorized");
    });
  });

  describe("Credential Queries", function () {
    it("Should get credential details", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      const claimKeys = ["name", "degree"];
      const claimValues = ["John Doe", "Bachelor of Science"];
      const expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      
      await credentialRegistry.connect(issuer1).issueCredential(
        "did:ethr:subject1",
        "EducationalCredential",
        claimKeys,
        claimValues,
        expirationDate,
        "https://example.com/schema",
        true
      );

      const credential = await credentialRegistry.getCredential(0);
      expect(credential.id).to.include("credential:");
      expect(credential.issuer).to.equal("did:ethr:issuer1");
      expect(credential.subject).to.equal("did:ethr:subject1");
      expect(credential.credentialStatus).to.equal("active");
      expect(credential.selectiveDisclosure).to.be.true;
    });

    it("Should get credential claims", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      const claimKeys = ["name", "degree"];
      const claimValues = ["John Doe", "Bachelor of Science"];
      
      await credentialRegistry.connect(issuer1).issueCredential(
        "did:ethr:subject1",
        "EducationalCredential",
        claimKeys,
        claimValues,
        0,
        "https://example.com/schema",
        true
      );

      expect(await credentialRegistry.getCredentialClaim(0, "name")).to.equal("John Doe");
      expect(await credentialRegistry.getCredentialClaim(0, "degree")).to.equal("Bachelor of Science");
    });

    it("Should get all credential claims", async function () {
      const { credentialRegistry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      const claimKeys = ["name", "degree"];
      const claimValues = ["John Doe", "Bachelor of Science"];
      
      await credentialRegistry.connect(issuer1).issueCredential(
        "did:ethr:subject1",
        "EducationalCredential",
        claimKeys,
        claimValues,
        0,
        "https://example.com/schema",
        true
      );

      const [keys, values] = await credentialRegistry.getAllCredentialClaims(0);
      expect(keys).to.deep.equal(claimKeys);
      expect(values).to.deep.equal(claimValues);
    });

    it("Should get subject credentials", async function () {
      const { credentialRegistry, issuer1, issuer2 } = await loadFixture(deployCredentialRegistryFixture);
      
      await issueTestCredential(credentialRegistry, issuer1, "did:ethr:subject1");
      await issueTestCredential(credentialRegistry, issuer2, "did:ethr:subject1");
      
      const subjectCredentials = await credentialRegistry.getSubjectCredentials("did:ethr:subject1");
      expect(subjectCredentials.length).to.equal(2);
      expect(subjectCredentials[0]).to.equal(0);
      expect(subjectCredentials[1]).to.equal(1);
    });
  });

  describe("Pause Functionality", function () {
    it("Should pause and unpause correctly", async function () {
      const { credentialRegistry, owner } = await loadFixture(deployCredentialRegistryFixture);
      
      await credentialRegistry.connect(owner).pause();
      expect(await credentialRegistry.paused()).to.be.true;
      
      await credentialRegistry.connect(owner).unpause();
      expect(await credentialRegistry.paused()).to.be.false;
    });

    it("Should reject operations when paused", async function () {
      const { credentialRegistry, owner, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      
      await credentialRegistry.connect(owner).pause();
      
      const claimKeys = ["name"];
      const claimValues = ["John Doe"];
      
      await expect(
        credentialRegistry.connect(issuer1).issueCredential(
          "did:ethr:subject1",
          "EducationalCredential",
          claimKeys,
          claimValues,
          0,
          "https://example.com/schema",
          true
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});