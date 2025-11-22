// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SSIRegistry {

    // mapping for trusted issuers
    mapping(address => bool) public trustedIssuers;

    // mapping for issued credentials (hash → true/false)
    mapping(bytes32 => bool) public issuedCredentials;

    // mapping for revoked credentials
    mapping(bytes32 => bool) public revokedCredentials;

    // Only contract owner can modify trusted issuers
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this");
        _;
    }

    // Add a trusted issuer (e.g., govt)
    function registerIssuer(address issuer) public onlyOwner {
        trustedIssuers[issuer] = true;
    }

    // Store credential hash on the blockchain
    function addCredential(bytes32 credentialHash) public onlyOwner {
        issuedCredentials[credentialHash] = true;
    }

    // Revoke a credential using its hash
    function revokeCredential(bytes32 credentialHash) public onlyOwner {
        revokedCredentials[credentialHash] = true;
    }

    // Check if issuer is trusted
    function isIssuerTrusted(address issuer) public view returns (bool) {
        return trustedIssuers[issuer];
    }

    // Check if credential is issued
    function isCredentialIssued(bytes32 credentialHash) public view returns (bool) {
        return issuedCredentials[credentialHash];
    }

    // Check if credential hash is revoked
    function isCredentialRevoked(bytes32 credentialHash) public view returns (bool) {
        return revokedCredentials[credentialHash];
    }
}
