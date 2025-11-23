# Verifier Backend API Documentation

## Overview

The Verifier Backend acts as a service provider that requests and verifies user credentials. It sends proof requests to wallet backends, polls for responses, and performs comprehensive verification of Verifiable Presentations (VPs).

**Base URL:** `http://localhost:5003` (default)

**Authentication:** No authentication required (in production, implement proper auth)

---

## Endpoints

### POST /send-request

Send a proof request to the wallet backend. This initiates the selective disclosure flow.

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
- `verifierId` (string, required) - Identifier for your verifier service
- `attributes` (array, required) - List of attributes to request
  - Supported: `over18`, `panLast4`, or any direct credential field (e.g., `name`, `dob`)
- `issuerPublicKey` (string, optional) - Filter to only accept credentials from this issuer

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "ok": true,
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**What happens:**
1. Request is forwarded to wallet backend's `/request-proof` endpoint
2. Wallet backend creates a pending request
3. Returns `requestId` for polling

**Error Responses:**

- `400 Bad Request` - Missing verifierId or attributes
- `500 Internal Server Error` - Failed to send request to wallet backend

**Example (curl):**
```bash
curl -X POST http://localhost:5003/send-request \
  -H "Content-Type: application/json" \
  -d '{
    "verifierId": "BankXYZ",
    "attributes": ["over18", "panLast4"],
    "issuerPublicKey": "0x1234..."
  }'
```

---

### GET /poll-request/:id

Poll the wallet backend for request status and VP (if approved). This is a polling endpoint - call it periodically until status changes from "pending".

**URL Parameters:**
- `id` (string, required) - The requestId from `/send-request`

**Response - Pending (200 OK):**
```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "verifierId": "BankXYZ",
    "attributes": ["over18", "panLast4"],
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response - Approved (200 OK):**
```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "verifierId": "BankXYZ",
    "attributes": ["over18", "panLast4"],
    "status": "approved",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "resolvedAt": "2024-01-15T10:31:00.000Z",
    "vp": {
      "vp": { "over18": true, "panLast4": "1234" },
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
}
```

**Response - Rejected (200 OK):**
```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "rejected",
    "resolvedAt": "2024-01-15T10:31:00.000Z"
  }
}
```

**Polling Strategy:**
- Start polling immediately after receiving `requestId`
- Poll every 2-5 seconds until status is no longer "pending"
- If `status === "approved"`, proceed to verify VP
- If `status === "rejected"`, inform user that request was denied

**Error Responses:**

- `404 Not Found` - Request ID not found on wallet backend
- `500 Internal Server Error` - Failed to poll request

**Example (curl):**
```bash
curl http://localhost:5003/poll-request/550e8400-e29b-41d4-a716-446655440000
```

---

### POST /verify-vp

Verify a Verifiable Presentation (VP). Performs comprehensive cryptographic and on-chain verification.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
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

**Parameters:**
- `vp` (object, required) - The complete Verifiable Presentation object

**Response - Verified (200 OK):**
```json
{
  "ok": true,
  "message": "VP verified successfully",
  "details": {
    "backendAddress": "0x5678...",
    "issuerAddress": "0x1234...",
    "onChain": {
      "isTrusted": true,
      "issued": true,
      "revoked": false
    },
    "derived": {
      "over18": true,
      "panLast4": "1234"
    }
  }
}
```

**Verification Steps:**
1. ✅ **Backend Signature Verification**
   - Reconstructs VP payload (without `backendSignature`)
   - Verifies `backendSignature` recovers to `backend.address`

2. ✅ **Issuer Signature Verification**
   - Verifies `issuerSignature` recovers to `issuerPublicKey`
   - Confirms issuer signed the credential hash

3. ✅ **On-Chain Checks**
   - `isIssuerTrusted(issuerPublicKey)` - Issuer is registered
   - `isCredentialIssued(credentialHash)` - Credential hash exists on blockchain
   - `isCredentialRevoked(credentialHash)` - Credential is NOT revoked

4. ✅ **Payload Validation**
   - Ensures required fields are present
   - Validates structure

**Error Responses:**

- `400 Bad Request` - Missing VP, malformed VP, signature verification failure, or on-chain check failure
- `500 Internal Server Error` - Failed to verify VP

**Common Error Messages:**
- `"Malformed VP: missing fields"` - Required fields missing
- `"Invalid backend signature format"` - Backend signature is malformed
- `"Backend signature does not match backend.address"` - Backend signature verification failed
- `"Invalid issuer signature format"` - Issuer signature is malformed
- `"Issuer signature does not match issuer public key"` - Issuer signature verification failed
- `"Issuer not trusted on-chain"` - Issuer not registered on blockchain
- `"Credential not recorded as issued on-chain"` - Credential hash not found on blockchain
- `"Credential has been revoked"` - Credential was revoked by issuer

**Example (curl):**
```bash
curl -X POST http://localhost:5003/verify-vp \
  -H "Content-Type: application/json" \
  -d '{
    "vp": {
      "vp": { "over18": true, "panLast4": "1234" },
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
  }'
```

---

## Complete Verification Flow

Here's the typical flow for a verifier:

1. **Send Request**
   ```bash
   POST /send-request
   → Receive requestId
   ```

2. **Poll for Response**
   ```bash
   GET /poll-request/:requestId
   → Poll until status !== "pending"
   → If approved, receive VP
   ```

3. **Verify VP**
   ```bash
   POST /verify-vp
   → Receive verification result
   ```

**Example Flow:**
```javascript
// 1. Send request
const { data } = await axios.post('http://localhost:5003/send-request', {
  verifierId: 'BankXYZ',
  attributes: ['over18', 'panLast4']
});
const requestId = data.data.requestId;

// 2. Poll for response
let request;
do {
  await sleep(2000); // Wait 2 seconds
  const response = await axios.get(`http://localhost:5003/poll-request/${requestId}`);
  request = response.data.data;
} while (request.status === 'pending');

// 3. Verify VP
if (request.status === 'approved') {
  const verifyResponse = await axios.post('http://localhost:5003/verify-vp', {
    vp: request.vp
  });
  console.log('Verification result:', verifyResponse.data);
}
```

---

## Supported Attributes

### Derived Attributes
- `over18` - Boolean indicating if holder is 18+ years old
- `panLast4` - Last 4 digits of PAN number

### Direct Attributes
- Any field from the credential can be requested directly
- Examples: `name`, `dob`, `pan`, `issuedAt`

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to run the server on | `5003` |
| `WALLET_BACKEND_URL` | URL of wallet backend | `http://localhost:5002` |

---

## Security Notes

- All VPs are cryptographically verified before acceptance
- On-chain checks ensure issuer trust and credential validity
- Backend signature ensures VP originated from the wallet backend
- Issuer signature ensures credential authenticity
- Revocation checks prevent use of invalidated credentials

---

## Error Handling

Always handle these scenarios:
- User rejects the request (`status === "rejected"`)
- VP verification fails (check error messages)
- Request not found (404)
- Network errors when communicating with wallet backend

