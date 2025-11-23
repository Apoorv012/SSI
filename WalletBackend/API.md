# Wallet Backend API Documentation

## Overview

The Wallet Backend acts as the user's credential wallet, storing Verifiable Credentials (VCs), managing proof requests, and generating Verifiable Presentations (VPs) with selective disclosure.

**Base URL:** `http://localhost:5002` (default)

**Authentication:** No authentication required (in production, implement proper auth)

---

## Endpoints

### POST /store-credential

Store and validate a Verifiable Credential in the wallet. Performs comprehensive validation before storing.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "vc": {
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
}
```

**Parameters:**
- `vc.vc` (object, required) - The actual credential data
- `vc.credentialHash` (string, required) - SHA-256 hash of the credential
- `vc.issuerPublicKey` (string, required) - Ethereum address of the issuer
- `vc.issuerSignature` (string, required) - Issuer's signature of the credential hash

**Response (200 OK):**
```json
{
  "ok": true,
  "stored": true,
  "message": "Credential successfully validated and stored"
}
```

**Validation Steps:**
1. ✅ Validates credential hash matches computed SHA-256 hash of `vc.vc`
2. ✅ Verifies issuer signature recovers to the provided `issuerPublicKey`
3. ✅ Checks on-chain: issuer is trusted
4. ✅ Checks on-chain: credential hash is issued
5. ✅ Checks on-chain: credential is not revoked
6. ✅ Stores credential in local storage (`storage.json`)

**Error Responses:**

- `400 Bad Request` - Invalid VC payload, hash mismatch, signature mismatch, or on-chain validation failure
- `500 Internal Server Error` - Internal error storing credential

**Example (curl):**
```bash
curl -X POST http://localhost:5002/store-credential \
  -H "Content-Type: application/json" \
  -d '{
    "vc": {
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
  }'
```

---

### GET /credentials

List all stored credentials in the wallet.

**Response (200 OK):**
```json
{
  "a1b2c3d4e5f6...": {
    "vc": { ... },
    "credentialHash": "a1b2c3d4e5f6...",
    "issuerPublicKey": "0x1234...",
    "issuerSignature": "0xabcd...",
    "storedAt": "2024-01-15T10:30:00.000Z"
  },
  "b2c3d4e5f6a1...": { ... }
}
```

The response is an object where keys are credential hashes and values are the stored credential objects.

**Example (curl):**
```bash
curl http://localhost:5002/credentials
```

---

### POST /request-proof

Create a proof request. Used by verifiers to request specific attributes from the wallet.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "verifierId": "BankXYZ",
  "attributes": ["over18", "panLast4"],
  "issuerPublicKey": "0x1234..."  // optional
}
```

**Parameters:**
- `verifierId` (string, required) - Identifier for the verifier requesting proof
- `attributes` (array, required) - List of attributes to request (e.g., `["over18", "panLast4", "name"]`)
- `issuerPublicKey` (string, optional) - Filter to only use credentials from this issuer

**Response (200 OK):**
```json
{
  "ok": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**What happens:**
1. Creates a new proof request with status "pending"
2. Stores request in `storage.json`
3. Returns unique `requestId` for tracking

**Example (curl):**
```bash
curl -X POST http://localhost:5002/request-proof \
  -H "Content-Type: application/json" \
  -d '{
    "verifierId": "BankXYZ",
    "attributes": ["over18", "panLast4"],
    "issuerPublicKey": "0x1234..."
  }'
```

---

### GET /pending-requests

Get all pending approval requests. Used by wallet UI to show requests awaiting user approval.

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "verifierId": "BankXYZ",
    "attributes": ["over18", "panLast4"],
    "issuerPublicKey": "0x1234...",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

**Example (curl):**
```bash
curl http://localhost:5002/pending-requests
```

---

### POST /respond

Approve or reject a proof request. If approved, automatically selects a matching credential, validates it, derives requested attributes, creates and signs a Verifiable Presentation (VP).

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "approve": true
}
```

**Parameters:**
- `requestId` (string, required) - The ID of the request to respond to
- `approve` (boolean, required) - `true` to approve and generate VP, `false` to reject

**Response - Approved (200 OK):**
```json
{
  "ok": true,
  "vp": {
    "vp": {
      "over18": true,
      "panLast4": "1234"
    },
    "credentialHash": "a1b2c3d4e5f6...",
    "issuerPublicKey": "0x1234...",
    "issuerSignature": "0xabcd...",
    "backend": {
      "address": "0x5678...",
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "backendSignature": "0xef01...",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "verifierId": "BankXYZ"
  }
}
```

**Response - Rejected (200 OK):**
```json
{
  "ok": true,
  "message": "Request rejected"
}
```

**What happens when approved:**
1. Finds matching credential that can fulfill requested attributes (with optional issuer filter)
2. Validates credential on-chain (issuer trusted, credential issued, not revoked)
3. Derives requested attributes:
   - `over18`: Computed from `dob` field (age >= 18)
   - `panLast4`: Last 4 digits of `pan` field
   - Direct attributes: Passed through from credential
4. Creates VP payload with derived attributes
5. Signs VP with wallet backend's private key
6. Updates request status to "approved"
7. Returns complete VP

**Error Responses:**

- `400 Bad Request` - Missing requestId/approve, request not found, request already handled, no matching credential, or validation failure
- `404 Not Found` - Request ID not found
- `500 Internal Server Error` - Failed to respond to request

**Example (curl):**
```bash
curl -X POST http://localhost:5002/respond \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "approve": true
  }'
```

---

### GET /requests/:id

Get a specific request by ID. Used by verifiers to poll for request status and VP.

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "verifierId": "BankXYZ",
  "attributes": ["over18", "panLast4"],
  "issuerPublicKey": "0x1234...",
  "status": "approved",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "resolvedAt": "2024-01-15T10:31:00.000Z",
  "vp": {
    "vp": { "over18": true, "panLast4": "1234" },
    ...
  }
}
```

**Status values:**
- `pending` - Waiting for user approval
- `approved` - Approved, VP generated
- `rejected` - Rejected by user

**Error Responses:**

- `404 Not Found` - Request ID not found

**Example (curl):**
```bash
curl http://localhost:5002/requests/550e8400-e29b-41d4-a716-446655440000
```

---

## Derived Attributes

The wallet backend can compute derived attributes from stored credentials:

### over18
- **Source:** `dob` (date of birth) field
- **Computation:** Calculates age from date of birth and checks if >= 18
- **Example:** `dob: "1990-01-01"` → `over18: true`

### panLast4
- **Source:** `pan` field
- **Computation:** Extracts last 4 characters
- **Example:** `pan: "ABCDE1234F"` → `panLast4: "1234"`

### Direct Attributes
- Any attribute that exists directly in the credential is passed through
- **Example:** `name`, `dob`, `pan` are passed through as-is

---

## Storage

Credentials and requests are stored in `storage.json`:
```json
{
  "credentials": {
    "<credentialHash>": { ... }
  },
  "requests": {
    "<requestId>": { ... }
  }
}
```

This file is created automatically on first run and persists data between restarts.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to run the server on | `5002` |

---

## Verifiable Presentation (VP) Structure

A VP contains:
- `vp` - Derived claims (selective disclosure)
- `credentialHash` - Hash of the original credential
- `issuerPublicKey` - Issuer's Ethereum address
- `issuerSignature` - Original issuer's signature
- `backend.address` - Wallet backend's Ethereum address
- `backend.timestamp` - When VP was created
- `backendSignature` - Wallet backend's signature of the VP payload
- `requestId` - ID of the proof request
- `verifierId` - ID of the verifier

---

## Security Notes

- All credentials are validated before storage (hash, signature, on-chain checks)
- Credentials are validated again before use in VP generation
- Wallet private key is stored in `wallet.json` (never commit to version control)
- VP signatures use Ethereum signature format for verification compatibility

