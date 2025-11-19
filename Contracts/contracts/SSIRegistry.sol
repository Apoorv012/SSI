// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SSIRegistry {

    // mapping for trusted issuers
    mapping(address => bool) public trustedIssuers;

    // mapping for revoked credential hashes
    mapping(bytes32 => bool) public revokedCredentials;

    // only contract owner can add issuers
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

    // Revoke a credential using its hash
    function revokeCredential(bytes32 credentialHash) public onlyOwner {
        revokedCredentials[credentialHash] = true;
    }

    // Verify if issuer is trusted
    function isIssuerTrusted(address issuer) public view returns (bool) {
        return trustedIssuers[issuer];
    }

    // Verify if credential hash is revoked
    function isCredentialRevoked(bytes32 credentialHash) public view returns (bool) {
        return revokedCredentials[credentialHash];
    }
}
