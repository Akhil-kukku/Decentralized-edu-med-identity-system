// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title CredentialRegistryV2
 * @dev Advanced Verifiable Credential Registry with selective disclosure and ZK-proof support
 * @author Your Name
 * @notice This contract manages verifiable credentials with enhanced security and privacy features
 */
contract CredentialRegistryV2 is Ownable, Pausable, ReentrancyGuard, Initializable {
    using Counters for Counters.Counter;

    // Verifiable Credential structure following W3C VC specification
    struct VerifiableCredential {
        string id;                    // Credential ID
        string[] credentialType;     // Credential types
        string issuer;               // Issuer DID
        string subject;              // Subject DID
        uint256 issuanceDate;        // Issuance timestamp
        uint256 expirationDate;      // Expiration timestamp
        string credentialStatus;     // Status (active, suspended, revoked)
        string credentialSchema;     // Schema reference
        string proof;                // Cryptographic proof
        bool selectiveDisclosure;    // Supports selective disclosure
        string zkProof;              // Zero-knowledge proof (if applicable)
        mapping(string => string) claims; // Credential claims
        string[] claimKeys;          // Keys for iteration
    }

    // Credential storage
    mapping(uint256 => VerifiableCredential) public credentials;
    Counters.Counter private _credentialCounter;

    // Issuer registry for authorized issuers
    mapping(address => bool) public authorizedIssuers;
    mapping(address => string) public issuerDIDs;

    // Subject credentials mapping
    mapping(string => uint256[]) public subjectCredentials;

    // Credential type registry
    mapping(string => bool) public supportedCredentialTypes;

    // Events
    event CredentialIssued(
        uint256 indexed credentialId,
        string indexed issuer,
        string indexed subject,
        string credentialType
    );
    event CredentialRevoked(uint256 indexed credentialId, string reason);
    event CredentialSuspended(uint256 indexed credentialId, string reason);
    event CredentialReactivated(uint256 indexed credentialId);
    event IssuerAuthorized(address indexed issuer, string did);
    event IssuerDeauthorized(address indexed issuer);
    event CredentialTypeSupported(string credentialType, bool supported);

    // Modifiers
    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "Not authorized issuer");
        _;
    }

    modifier validCredentialId(uint256 credentialId) {
        require(credentialId < _credentialCounter.current(), "Invalid credential ID");
        _;
    }

    modifier onlyIssuerOrOwner(uint256 credentialId) {
        require(
            msg.sender == owner() || 
            keccak256(bytes(credentials[credentialId].issuer)) == keccak256(bytes(issuerDIDs[msg.sender])),
            "Not authorized"
        );
        _;
    }

    /**
     * @dev Initialize the contract
     */
    function initialize() public initializer {
        _transferOwnership(msg.sender);
        
        // Support common credential types
        supportedCredentialTypes["VerifiableCredential"] = true;
        supportedCredentialTypes["EducationalCredential"] = true;
        supportedCredentialTypes["ProfessionalCredential"] = true;
        supportedCredentialTypes["IdentityCredential"] = true;
    }

    /**
     * @dev Authorize an issuer
     * @param issuer Address of the issuer
     * @param did DID of the issuer
     */
    function authorizeIssuer(address issuer, string memory did) external onlyOwner {
        require(bytes(did).length > 0, "DID cannot be empty");
        authorizedIssuers[issuer] = true;
        issuerDIDs[issuer] = did;
        emit IssuerAuthorized(issuer, did);
    }

    /**
     * @dev Deauthorize an issuer
     * @param issuer Address of the issuer
     */
    function deauthorizeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        delete issuerDIDs[issuer];
        emit IssuerDeauthorized(issuer);
    }

    /**
     * @dev Add support for a credential type
     * @param credentialType The credential type to support
     * @param supported Whether to support this type
     */
    function setCredentialTypeSupport(string memory credentialType, bool supported) external onlyOwner {
        supportedCredentialTypes[credentialType] = supported;
        emit CredentialTypeSupported(credentialType, supported);
    }

    /**
     * @dev Issue a verifiable credential
     * @param subject Subject DID
     * @param credentialType Type of credential
     * @param claimKeys Array of claim keys
     * @param claimValues Array of claim values
     * @param expirationDate Expiration timestamp (0 for no expiration)
     * @param credentialSchema Schema reference
     * @param supportsSelectiveDisclosure Whether credential supports selective disclosure
     */
    function issueCredential(
        string memory subject,
        string memory credentialType,
        string[] memory claimKeys,
        string[] memory claimValues,
        uint256 expirationDate,
        string memory credentialSchema,
        bool supportsSelectiveDisclosure
    ) external whenNotPaused nonReentrant onlyAuthorizedIssuer {
        require(bytes(subject).length > 0, "Subject cannot be empty");
        require(supportedCredentialTypes[credentialType], "Unsupported credential type");
        require(claimKeys.length == claimValues.length, "Claims arrays length mismatch");
        require(expirationDate == 0 || expirationDate > block.timestamp, "Invalid expiration date");

        uint256 credentialId = _credentialCounter.current();
        _credentialCounter.increment();

        VerifiableCredential storage cred = credentials[credentialId];
        cred.id = string(abi.encodePacked("credential:", _toString(credentialId)));
        cred.credentialType.push("VerifiableCredential");
        cred.credentialType.push(credentialType);
        cred.issuer = issuerDIDs[msg.sender];
        cred.subject = subject;
        cred.issuanceDate = block.timestamp;
        cred.expirationDate = expirationDate;
        cred.credentialStatus = "active";
        cred.credentialSchema = credentialSchema;
        cred.selectiveDisclosure = supportsSelectiveDisclosure;

        // Add claims
        for (uint256 i = 0; i < claimKeys.length; i++) {
            cred.claims[claimKeys[i]] = claimValues[i];
            cred.claimKeys.push(claimKeys[i]);
        }

        // Add to subject's credentials
        subjectCredentials[subject].push(credentialId);

        emit CredentialIssued(credentialId, cred.issuer, subject, credentialType);
    }

    /**
     * @dev Issue a credential with zero-knowledge proof
     * @param subject Subject DID
     * @param credentialType Type of credential
     * @param zkProof Zero-knowledge proof
     * @param expirationDate Expiration timestamp
     */
    function issueCredentialWithZKProof(
        string memory subject,
        string memory credentialType,
        string memory zkProof,
        uint256 expirationDate
    ) external whenNotPaused nonReentrant onlyAuthorizedIssuer {
        require(bytes(subject).length > 0, "Subject cannot be empty");
        require(supportedCredentialTypes[credentialType], "Unsupported credential type");
        require(bytes(zkProof).length > 0, "ZK proof cannot be empty");

        uint256 credentialId = _credentialCounter.current();
        _credentialCounter.increment();

        VerifiableCredential storage cred = credentials[credentialId];
        cred.id = string(abi.encodePacked("credential:", _toString(credentialId)));
        cred.credentialType.push("VerifiableCredential");
        cred.credentialType.push(credentialType);
        cred.issuer = issuerDIDs[msg.sender];
        cred.subject = subject;
        cred.issuanceDate = block.timestamp;
        cred.expirationDate = expirationDate;
        cred.credentialStatus = "active";
        cred.zkProof = zkProof;
        cred.selectiveDisclosure = true;

        subjectCredentials[subject].push(credentialId);

        emit CredentialIssued(credentialId, cred.issuer, subject, credentialType);
    }

    /**
     * @dev Revoke a credential
     * @param credentialId ID of the credential to revoke
     * @param reason Reason for revocation
     */
    function revokeCredential(uint256 credentialId, string memory reason) 
        external whenNotPaused nonReentrant validCredentialId(credentialId) onlyIssuerOrOwner(credentialId) {
        credentials[credentialId].credentialStatus = "revoked";
        emit CredentialRevoked(credentialId, reason);
    }

    /**
     * @dev Suspend a credential
     * @param credentialId ID of the credential to suspend
     * @param reason Reason for suspension
     */
    function suspendCredential(uint256 credentialId, string memory reason) 
        external whenNotPaused nonReentrant validCredentialId(credentialId) onlyIssuerOrOwner(credentialId) {
        credentials[credentialId].credentialStatus = "suspended";
        emit CredentialSuspended(credentialId, reason);
    }

    /**
     * @dev Reactivate a suspended credential
     * @param credentialId ID of the credential to reactivate
     */
    function reactivateCredential(uint256 credentialId) 
        external whenNotPaused nonReentrant validCredentialId(credentialId) onlyIssuerOrOwner(credentialId) {
        require(
            keccak256(bytes(credentials[credentialId].credentialStatus)) == keccak256(bytes("suspended")),
            "Credential not suspended"
        );
        credentials[credentialId].credentialStatus = "active";
        emit CredentialReactivated(credentialId);
    }

    /**
     * @dev Verify a credential
     * @param credentialId ID of the credential to verify
     * @return True if credential is valid and active
     */
    function verifyCredential(uint256 credentialId) external view validCredentialId(credentialId) returns (bool) {
        VerifiableCredential storage cred = credentials[credentialId];
        
        // Check if credential is active
        if (keccak256(bytes(cred.credentialStatus)) != keccak256(bytes("active"))) {
            return false;
        }
        
        // Check if credential has expired
        if (cred.expirationDate > 0 && block.timestamp > cred.expirationDate) {
            return false;
        }
        
        return true;
    }

    /**
     * @dev Get credential details
     * @param credentialId ID of the credential
     * @return id Credential ID
     * @return credType Credential types
     * @return issuer Issuer DID
     * @return subject Subject DID
     * @return issuanceDate Issuance timestamp
     * @return expirationDate Expiration timestamp
     * @return credentialStatus Credential status
     * @return credentialSchema Schema reference
     * @return selectiveDisclosure Whether supports selective disclosure
     * @return zkProof Zero-knowledge proof
     */
    function getCredential(uint256 credentialId) external view validCredentialId(credentialId) returns (
        string memory id,
        string[] memory credType,
        string memory issuer,
        string memory subject,
        uint256 issuanceDate,
        uint256 expirationDate,
        string memory credentialStatus,
        string memory credentialSchema,
        bool selectiveDisclosure,
        string memory zkProof
    ) {
        VerifiableCredential storage cred = credentials[credentialId];
        return (
            cred.id,
            cred.credentialType,
            cred.issuer,
            cred.subject,
            cred.issuanceDate,
            cred.expirationDate,
            cred.credentialStatus,
            cred.credentialSchema,
            cred.selectiveDisclosure,
            cred.zkProof
        );
    }

    /**
     * @dev Get credential claim
     * @param credentialId ID of the credential
     * @param claimKey Key of the claim
     * @return Claim value
     */
    function getCredentialClaim(uint256 credentialId, string memory claimKey) 
        external view validCredentialId(credentialId) returns (string memory) {
        return credentials[credentialId].claims[claimKey];
    }

    /**
     * @dev Get all claims for a credential
     * @param credentialId ID of the credential
     * @return claimKeys Array of claim keys
     * @return claimValues Array of claim values
     */
    function getAllCredentialClaims(uint256 credentialId) 
        external view validCredentialId(credentialId) returns (string[] memory claimKeys, string[] memory claimValues) {
        VerifiableCredential storage cred = credentials[credentialId];
        claimKeys = cred.claimKeys;
        claimValues = new string[](cred.claimKeys.length);
        
        for (uint256 i = 0; i < cred.claimKeys.length; i++) {
            claimValues[i] = cred.claims[cred.claimKeys[i]];
        }
    }

    /**
     * @dev Get credentials for a subject
     * @param subject Subject DID
     * @return Array of credential IDs
     */
    function getSubjectCredentials(string memory subject) external view returns (uint256[] memory) {
        return subjectCredentials[subject];
    }

    /**
     * @dev Get total number of credentials
     * @return Total count
     */
    function getTotalCredentials() external view returns (uint256) {
        return _credentialCounter.current();
    }

    /**
     * @dev Emergency pause function
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause function
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
