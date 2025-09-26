// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract IdentityRegistry {
    // Maps user address → DID document hash
    mapping(address => string) private identities;

    // Event emitted when a new identity is registered
    event IdentityRegistered(address indexed user, string didDocHash);

    // Register a new identity
    function registerIdentity(address user, string memory didDocHash) public {
        identities[user] = didDocHash;
        emit IdentityRegistered(user, didDocHash);
    }

    // Resolve an identity
    function resolveIdentity(address user) public view returns (string memory) {
        return identities[user];
    }
}
