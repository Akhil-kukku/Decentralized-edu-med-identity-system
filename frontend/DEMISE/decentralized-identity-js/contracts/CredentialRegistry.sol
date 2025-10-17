// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CredentialRegistry {
    struct Credential {
        address issuer;
        address subject;
        string credentialHash;
        bool revoked;
    }

    Credential[] public credentials;

    // Events
    event CredentialIssued(uint indexed credentialId, address indexed subject, string credentialHash);
    event CredentialRevoked(uint indexed credentialId);

    // Issue a credential
    function issueCredential(address subject, string memory credentialHash) public {
        credentials.push(Credential({
            issuer: msg.sender,
            subject: subject,
            credentialHash: credentialHash,
            revoked: false
        }));
        uint id = credentials.length - 1;
        emit CredentialIssued(id, subject, credentialHash);
    }

    // Revoke a credential
    function revokeCredential(uint credentialId) public {
        require(credentialId < credentials.length, "Invalid credential ID");
        credentials[credentialId].revoked = true;
        emit CredentialRevoked(credentialId);
    }

    // Verify if a credential is valid
    function verifyCredential(uint credentialId) public view returns (bool) {
        require(credentialId < credentials.length, "Invalid credential ID");
        return !credentials[credentialId].revoked;
    }
}
