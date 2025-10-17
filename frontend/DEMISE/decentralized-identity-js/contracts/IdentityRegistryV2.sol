// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title IdentityRegistryV2
 * @dev Advanced Decentralized Identity Registry with security, upgradeability, and W3C DID compliance
 * @author Your Name
 * @notice This contract manages decentralized identities with enhanced security and features
 */
contract IdentityRegistryV2 is Ownable, Pausable, ReentrancyGuard, Initializable {
    using Counters for Counters.Counter;

    // DID Document structure following W3C DID specification
    struct DIDDocument {
        string id;                    // DID identifier
        string[] context;            // JSON-LD contexts
        string[] verificationMethod; // Verification methods
        string[] authentication;     // Authentication methods
        string[] assertionMethod;    // Assertion methods
        string[] capabilityInvocation; // Capability invocation methods
        string[] capabilityDelegation; // Capability delegation methods
        string[] keyAgreement;       // Key agreement methods
        string[] service;            // Service endpoints
        uint256 created;             // Creation timestamp
        uint256 updated;             // Last update timestamp
        bool active;                 // Active status
    }

    // Mapping from address to DID document
    mapping(address => DIDDocument) private identities;
    
    // Mapping from DID to address for reverse lookup
    mapping(string => address) private didToAddress;
    
    // Counter for unique DID generation
    Counters.Counter private _didCounter;
    
    // Events following W3C DID specification
    event DIDCreated(address indexed user, string indexed did, uint256 timestamp);
    event DIDUpdated(address indexed user, string indexed did, uint256 timestamp);
    event DIDDeactivated(address indexed user, string indexed did, uint256 timestamp);
    event VerificationMethodAdded(address indexed user, string indexed did, string method);
    event ServiceEndpointAdded(address indexed user, string indexed did, string endpoint);

    // Modifiers
    modifier onlyIdentityOwner(address user) {
        require(msg.sender == user || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier validDID(string memory did) {
        require(bytes(did).length > 0, "Invalid DID");
        require(didToAddress[did] != address(0), "DID not found");
        _;
    }

    /**
     * @dev Initialize the contract (for proxy pattern)
     */
    function initialize() public initializer {
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Create a new DID for the caller
     * @param did The DID identifier (must be unique)
     * @param context Array of JSON-LD contexts
     * @param verificationMethod Array of verification methods
     */
    function createDID(
        string memory did,
        string[] memory context,
        string[] memory verificationMethod
    ) external whenNotPaused nonReentrant {
        require(bytes(did).length > 0, "DID cannot be empty");
        require(didToAddress[did] == address(0), "DID already exists");
        require(identities[msg.sender].created == 0, "Address already has DID");

        uint256 timestamp = block.timestamp;
        
        identities[msg.sender] = DIDDocument({
            id: did,
            context: context,
            verificationMethod: verificationMethod,
            authentication: new string[](0),
            assertionMethod: new string[](0),
            capabilityInvocation: new string[](0),
            capabilityDelegation: new string[](0),
            keyAgreement: new string[](0),
            service: new string[](0),
            created: timestamp,
            updated: timestamp,
            active: true
        });

        didToAddress[did] = msg.sender;
        _didCounter.increment();

        emit DIDCreated(msg.sender, did, timestamp);
    }

    /**
     * @dev Update an existing DID document
     * @param did The DID identifier
     * @param context Updated JSON-LD contexts
     * @param verificationMethod Updated verification methods
     */
    function updateDID(
        string memory did,
        string[] memory context,
        string[] memory verificationMethod
    ) external whenNotPaused nonReentrant validDID(did) {
        require(didToAddress[did] == msg.sender, "Not DID owner");
        require(identities[msg.sender].active, "DID is deactivated");

        identities[msg.sender].context = context;
        identities[msg.sender].verificationMethod = verificationMethod;
        identities[msg.sender].updated = block.timestamp;

        emit DIDUpdated(msg.sender, did, block.timestamp);
    }

    /**
     * @dev Deactivate a DID
     * @param did The DID identifier to deactivate
     */
    function deactivateDID(string memory did) external whenNotPaused nonReentrant validDID(did) {
        require(didToAddress[did] == msg.sender, "Not DID owner");
        
        identities[msg.sender].active = false;
        identities[msg.sender].updated = block.timestamp;
        
        emit DIDDeactivated(msg.sender, did, block.timestamp);
    }

    /**
     * @dev Add verification method to DID
     * @param did The DID identifier
     * @param method The verification method to add
     */
    function addVerificationMethod(string memory did, string memory method) 
        external whenNotPaused nonReentrant validDID(did) {
        require(didToAddress[did] == msg.sender, "Not DID owner");
        require(identities[msg.sender].active, "DID is deactivated");
        require(bytes(method).length > 0, "Method cannot be empty");

        identities[msg.sender].verificationMethod.push(method);
        identities[msg.sender].updated = block.timestamp;

        emit VerificationMethodAdded(msg.sender, did, method);
    }

    /**
     * @dev Add service endpoint to DID
     * @param did The DID identifier
     * @param endpoint The service endpoint to add
     */
    function addServiceEndpoint(string memory did, string memory endpoint) 
        external whenNotPaused nonReentrant validDID(did) {
        require(didToAddress[did] == msg.sender, "Not DID owner");
        require(identities[msg.sender].active, "DID is deactivated");
        require(bytes(endpoint).length > 0, "Endpoint cannot be empty");

        identities[msg.sender].service.push(endpoint);
        identities[msg.sender].updated = block.timestamp;

        emit ServiceEndpointAdded(msg.sender, did, endpoint);
    }

    /**
     * @dev Resolve a DID document
     * @param user The address to resolve
     * @return The DID document
     */
    function resolveDID(address user) external view returns (DIDDocument memory) {
        require(identities[user].created > 0, "DID not found");
        return identities[user];
    }

    /**
     * @dev Resolve DID by identifier
     * @param did The DID identifier
     * @return The DID document
     */
    function resolveDIDById(string memory did) external view validDID(did) returns (DIDDocument memory) {
        address user = didToAddress[did];
        return identities[user];
    }

    /**
     * @dev Check if an address has an active DID
     * @param user The address to check
     * @return True if address has active DID
     */
    function hasActiveDID(address user) external view returns (bool) {
        return identities[user].created > 0 && identities[user].active;
    }

    /**
     * @dev Get total number of DIDs created
     * @return Total count
     */
    function getTotalDIDs() external view returns (uint256) {
        return _didCounter.current();
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
}