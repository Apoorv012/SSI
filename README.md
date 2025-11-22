# 📌 Blockchain-Based Self-Sovereign Identity (SSI) System with Selective Disclosure

## 🎯 Problem Statement

Today, organizations (banks, employers, service providers) ask users to share full identity documents (Aadhaar, PAN, Passport, DL, Degrees).

However, they usually need only a tiny part (e.g., "Is the user above 18?", "Last 4 digits of PAN?", "Does the user have a valid degree?").

### This leads to:

- **Excessive data sharing** - Users share more data than necessary
- **Privacy leakage** - Sensitive personal information exposed unnecessarily
- **User loss of control** - Once shared, users can't control how their data is used
- **No revocation control** - Once data is shared → provider owns it forever

## 🎯 Objective

Build a prototype SSI system where:

- **Issuers** (Government/University) issue cryptographically signed credentials
- **Users** (Holders) store these credentials in a secure wallet backend
- **Verifiers** request only specific attributes
- **Users** approve selective disclosure
- **Blockchain** stores trusted issuers & credential revocation state, ensuring tamper-proof verification

### This allows:

- ✅ **Selective disclosure** - Share only what's needed
- ✅ **User-controlled identity** - Users control their data
- ✅ **Verified authenticity** - Cryptographic proof of credential validity
- ✅ **Revocation** - Issuers can revoke invalid credentials
- ✅ **Zero dependence on centralized servers** - Trust anchored on blockchain

---

## 🏗️ System Architecture Overview

Your SSI system is divided into four modular components, each representing a real SSI role.

### 🟦 1. ISSUER BACKEND (Govt/University Simulator)

**Purpose:** Acts as the trusted authority that issues and revokes credentials.

**Responsibilities:**

- ✔ Generates credentials based on input (name, dob, pan…)
- ✔ Hashes credential using SHA-256
- ✔ Signs hash using Ethereum secp256k1 private key
- ✔ Stores credential hash on blockchain (addCredential)
- ✔ Registers issuer on blockchain (one-time)
- ✔ Revokes credentials (revokeCredential)

**Endpoints:**

- `POST /issue` - Issue a new credential
- `POST /revoke` - Revoke an existing credential

**Security:**

- Protected via Admin API key
- Only issuer backend can issue/revoke
- Issuer private key stored securely
- Issuer identifies on blockchain via Ethereum address

**Location:** `Issuer/`

---

### 🟧 2. BLOCKCHAIN LAYER (Smart Contract)

**Smart Contract:** `SSIRegistry.sol`

**Stores:**

- ✔ Trusted issuers (issuerAddress → true)
- ✔ Issued credential hashes
- ✔ Revoked credential hashes

**Functions:**

- `registerIssuer(address)` - Register a trusted issuer
- `addCredential(bytes32)` - Store credential hash
- `revokeCredential(bytes32)` - Mark credential as revoked
- `isIssuerTrusted(address)` - Check if issuer is trusted
- `isCredentialIssued(bytes32)` - Check if credential exists
- `isCredentialRevoked(bytes32)` - Check revocation status

### Why Blockchain?

- ✅ **Publicly verifiable** - Anyone can verify credential status
- ✅ **Tamper-proof** - Immutable record of credentials and issuers
- ✅ **Eliminates need to trust backend databases** - Trust is decentralized
- ✅ **Ensures only registered issuers are valid** - Authorization on-chain
- ✅ **Provides credential revocation transparency** - Public revocation registry

**Location:** `Contracts/`

---

### 🟩 3. WALLET BACKEND (Trusted Holder Service)

**Purpose:** Acts as the user's credential wallet — similar to Apple Wallet or DigiLocker.

**Responsibilities:**

- ✔ Stores issued VC (Verifiable Credentials)
- ✔ Accepts proof requests from verifier
- ✔ Shows approval request via UI
- ✔ Computes derived attributes (over18, panLast4)
- ✔ Creates Verifiable Presentation (VP)
- ✔ Signs VP with wallet private key
- ✔ Sends VP to verifier

**VP contains:**

- Derived claims (not full credential)
- Original issuer signature
- Credential hash
- Wallet signature
- Wallet public key

**This ensures:**

- Only approved data is shared
- User controls disclosure
- Integrity is cryptographically guaranteed

**Status:** *Planned / To be implemented*

---

### 🟨 4. WALLET UI (User Interface)

**Responsibilities:**

- ✔ Import credential into wallet
- ✔ Display credential summary
- ✔ Handle incoming verifier requests
- ✔ Show user approval popup
- ✔ On approve → trigger wallet backend to generate VP

This UI demonstrates user-controlled identity in SSI.

**Status:** *Planned / To be implemented*

---

### 🟫 5. VERIFIER BACKEND

**Responsibilities:**

- ✔ Requests only required attributes (e.g., over18, panLast4)
- ✔ Receives Verifiable Presentation (VP)
- ✔ Validates:
  - `issuerSignature` - Verifies issuer's signature
  - `backendSignature` - Verifies wallet's signature
  - `isIssuerTrusted` - Checks issuer trust status on blockchain
  - `isCredentialIssued` - Verifies credential existence
  - `isCredentialRevoked` - Checks revocation status
- ✔ Displays "Verification Success / Failure"

This completes the trust triangle: **Issuer → Holder → Verifier**

**Status:** *Planned / To be implemented*

---

## 🔐 Cryptography Used

- **SHA-256** hashing for credential fingerprint
- **ECDSA secp256k1** signing (Ethereum standard)
- **Ethereum signature recovery** for verification
- **Blockchain trust anchor** for issuer + credential state

---

## 📦 Data Flow Summary

### 1. Credential Issuance
```
User → Issuer /issue → VC (signed) → Blockchain stores hash
```

### 2. User Stores VC
```
VC → Wallet Backend
```

### 3. Verifier Requests Proof
```
Verifier → Wallet Backend → Wallet UI popup
```

### 4. User Approves
```
Wallet Backend → Derives claim → Signs VP → Sends VP
```

### 5. Verifier Validates
```
VP + Blockchain → Valid / Invalid
```

---

## ⭐ Why This Architecture is Correct for SSI

- ✔ Issuer is separate (required in real SSI)
- ✔ Wallet backend is separate (user-controlled)
- ✔ Selective disclosure without zero-knowledge (simplified POC)
- ✔ Blockchain anchors trust, not data
- ✔ Cryptographic signatures ensure integrity
- ✔ Revocation ensures dynamic validity
- ✔ User approval ensures control

---

## 📚 Tech Stack

- **Backend:** Node.js, Express
- **Cryptography:** ethers.js (ECDSA), crypto (SHA-256)
- **Blockchain:** Hardhat local blockchain, Solidity
- **Frontend:** React.js for wallet UI *(Planned)*
- **Storage:** JSON / filesystem (POC)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Hardhat (for blockchain development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SSI
   ```

2. **Setup Blockchain Layer**
   ```bash
   cd Contracts
   npm install
   npx hardhat compile
   npx hardhat node  # Start local blockchain
   ```

3. **Deploy Smart Contract**
   ```bash
   # In a new terminal
   cd Contracts
   npx hardhat run scripts/deploy.js --network localhost
   ```

4. **Setup Issuer Backend**
   ```bash
   cd ../Issuer
   npm install
   ```

5. **Configure Environment Variables**
   Create a `.env` file in the `Issuer/` directory:
   ```env
   PORT=5001
   ISSUER_ADMIN_KEY=your-secret-admin-key
   ```

6. **Generate Issuer Keys**
   ```bash
   node issuerKeys.js
   ```

7. **Start Issuer Service**
   ```bash
   node index.js
   ```

### Testing

1. **Test Issuer Registration and Credential Issuance**
   ```bash
   cd Issuer
   node tests/testIssuer.js
   node testCredentialIssued.js
   ```

---

## 📖 Usage Examples

### Issue a Credential

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

### Revoke a Credential

```bash
curl -X POST http://localhost:5001/revoke \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-secret-admin-key" \
  -d '{
    "credentialHash": "<credential-hash>"
  }'
```

---

## 📁 Project Structure

```
SSI/
├── Contracts/              # Blockchain Layer
│   ├── contracts/
│   │   └── SSIRegistry.sol
│   ├── scripts/
│   │   ├── deploy.js
│   │   └── interact.js
│   └── hardhat.config.js
│
├── Issuer/                # Issuer Backend
│   ├── index.js          # Main server file
│   ├── contract.js       # Smart contract interaction
│   ├── keys.js           # Key management
│   └── tests/            # Test files
│
├── Wallet/                # Wallet Backend (Planned)
│
├── WalletUI/              # Wallet Frontend (Planned)
│
└── Verifier/              # Verifier Backend (Planned)
```

---

## 🔒 Security Considerations

- **Private Keys:** Never commit private keys to version control
- **API Keys:** Use environment variables for sensitive configuration
- **Network Security:** In production, use HTTPS and secure WebSocket connections
- **Key Management:** Implement proper key storage (hardware security modules for production)

---

## 🛠️ Development Roadmap

- [x] Blockchain Layer (Smart Contract)
- [x] Issuer Backend
- [ ] Wallet Backend
- [ ] Wallet UI
- [ ] Verifier Backend
- [ ] Integration Testing
- [ ] Production Deployment Guide

---

**Note:** This is a proof-of-concept implementation. For production use, consider additional security measures, key management solutions, and compliance with relevant regulations (GDPR, etc.).

