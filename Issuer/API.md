# Issuer Backend API Documentation

## Overview

The Issuer Backend acts as the trusted authority that issues and revokes credentials. It generates Verifiable Credentials (VCs), signs them cryptographically, and records credential hashes on the blockchain.

**Base URL:** `http://localhost:5001` (default)

**Authentication:** All endpoints require the `x-admin-key` header matching the `ISSUER_ADMIN_KEY` environment variable.

---

## Endpoints

### POST /issue

Issue a new Verifiable Credential.

**Request Headers:**
```
Content-Type: application/json
x-admin-key: <your-secret-admin-key>
```

**Request Body:**
```json
{
  "name": "John Doe",
  "dob": "1990-01-01",
  "pan": "ABCDE1234F"
}
```

**Parameters:**
- `name` (string, required) - Full name of the credential holder
- `dob` (string, required) - Date of birth in YYYY-MM-DD format
- `pan` (string, required) - PAN number

**Response (200 OK):**
```json
{
  "vc": {
    "name": "John Doe",
    "dob": "1990-01-01",
    "pan": "ABCDE1234F",
    "issuedAt": "2024-01-15T10:30:00.000Z"
  },
  "credentialHash": "a1b2c3d4e5f6...",
  "issuerPublicKey": "0x1234...",
  "issuerSignature": "0xabcd..."
}
```

**Response Fields:**
- `vc` - The actual credential data
- `credentialHash` - SHA-256 hash of the credential (hex string)
- `issuerPublicKey` - Ethereum address of the issuer
- `issuerSignature` - ECDSA signature of the credential hash

**What happens:**
1. Credential object is created with the provided fields
2. Credential is hashed using SHA-256
3. Hash is signed using issuer's Ethereum private key
4. Credential hash is stored on blockchain via `addCredential()` call
5. Complete VC object is returned

**Error Responses:**

- `400 Bad Request` - Missing required fields
- `403 Forbidden` - Invalid or missing admin key
- `500 Internal Server Error` - Error issuing credential or blockchain interaction failure

**Example (curl):**
```bash
curl -X POST http://localhost:5001/issue \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-secret-admin-key" \
  -d '{
    "name": "John Doe",
    "dob": "1990-01-01",
    "pan": "ABCDE1234F"
  }'
```

---

### POST /revoke

Revoke an existing credential by marking it as revoked on the blockchain.

**Request Headers:**
```
Content-Type: application/json
x-admin-key: <your-secret-admin-key>
```

**Request Body:**
```json
{
  "credentialHash": "a1b2c3d4e5f6..."
}
```

**Parameters:**
- `credentialHash` (string, required) - The hex hash of the credential to revoke

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Credential revoked on blockchain"
}
```

**What happens:**
1. Credential hash is padded to bytes32 format
2. Blockchain contract's `revokeCredential()` is called
3. Transaction is confirmed on blockchain
4. Credential is now marked as revoked and will fail verification

**Error Responses:**

- `400 Bad Request` - Missing credentialHash
- `403 Forbidden` - Invalid or missing admin key
- `500 Internal Server Error` - Blockchain interaction failure

**Example (curl):**
```bash
curl -X POST http://localhost:5001/revoke \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-secret-admin-key" \
  -d '{
    "credentialHash": "a1b2c3d4e5f6..."
  }'
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to run the server on | `5001` |
| `ISSUER_ADMIN_KEY` | Admin key for protecting endpoints | *Required* |

---

## Initialization

On startup, the Issuer Backend automatically:
1. Checks if the issuer address is registered on the blockchain
2. If not registered, automatically calls `registerIssuer()` to register itself
3. Logs the registration status

---

## Cryptography Details

- **Hashing:** SHA-256 (crypto.createHash)
- **Signing:** ECDSA secp256k1 via ethers.js
- **Signature Format:** Ethereum signature (hex string with 0x prefix)
- **Hash Format:** Hex string without 0x prefix for credentialHash

---

## Smart Contract Interaction

The Issuer Backend interacts with the `SSIRegistry` smart contract:
- `registerIssuer(address)` - Register issuer on blockchain (auto-called at startup)
- `addCredential(bytes32)` - Store credential hash (called during `/issue`)
- `revokeCredential(bytes32)` - Mark credential as revoked (called during `/revoke`)

---

## Security Notes

- All endpoints are protected by admin key authentication
- Issuer private key is stored in `issuer.json` (never commit to version control)
- Private key is loaded securely and used only for signing
- Blockchain operations are atomic (transaction waits for confirmation)

