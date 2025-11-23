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

**Key Features:**

- Generates and signs Verifiable Credentials (VCs)
- Stores credential hashes on blockchain
- Revokes credentials with blockchain updates
- Auto-registers issuer on blockchain at startup
- Protected via Admin API key authentication

**Default Port:** `5001`

**Documentation:** See [`Issuer/API.md`](Issuer/API.md) for complete API documentation

**Status:** ✅ **Implemented**

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

- ✔ Stores issued VC (Verifiable Credentials) with full validation
- ✔ Accepts proof requests from verifier
- ✔ Manages pending approval requests
- ✔ Computes derived attributes (over18, panLast4)
- ✔ Creates Verifiable Presentation (VP)
- ✔ Signs VP with wallet private key
- ✔ Validates credentials before storing/using (issuer trust, on-chain checks)

**Key Features:**

- Stores and validates Verifiable Credentials with comprehensive checks
- Manages proof requests from verifiers
- Computes derived attributes (over18, panLast4)
- Generates and signs Verifiable Presentations (VPs)
- Validates credentials on-chain before storage/use

**Derived Attributes:**

- `over18` - Computed from date of birth
- `panLast4` - Last 4 digits of PAN
- Direct attributes - Passed through from credential

**Default Port:** `5002`

**Documentation:** See [`WalletBackend/API.md`](WalletBackend/API.md) for complete API documentation

**Status:** ✅ **Implemented**

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

**Purpose:** Acts as a service provider that requests and verifies user credentials.

**Key Features:**

- Sends proof requests to wallet backend
- Polls for user responses
- Receives Verifiable Presentations (VPs)
- Performs comprehensive VP verification:
  - Backend signature verification
  - Issuer signature verification
  - On-chain trust, issuance, and revocation checks

**Default Port:** `5003`

**Documentation:** See [`Verifier/API.md`](Verifier/API.md) for complete API documentation

**Status:** ✅ **Implemented**

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

### 2. User Stores VC in Wallet
```
VC → Wallet Backend /store-credential
Wallet validates: hash, issuer signature, on-chain status
VC stored locally in storage.json
```

### 3. Verifier Requests Proof
```
Verifier /send-request → Wallet Backend /request-proof
Wallet creates pending request
```

### 4. User Approves (via Wallet UI or direct API call)
```
Wallet Backend /respond (approve: true)
→ Auto-selects matching credential
→ Validates on-chain status
→ Derives requested attributes
→ Creates and signs VP
→ Returns VP
```

### 5. Verifier Polls for Response
```
Verifier /poll-request/:id → Wallet Backend /requests/:id
Receives VP if approved
```

### 6. Verifier Validates VP
```
Verifier /verify-vp
Validates: backend signature, issuer signature, on-chain checks
Returns: Verification success/failure
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

5. **Setup Wallet Backend**
   ```bash
   cd ../WalletBackend
   npm install
   ```
   
   Create a `.env` file (optional, defaults will be used):
   ```env
   PORT=5002
   ```

6. **Setup Verifier Backend**
   ```bash
   cd ../Verifier
   npm install
   ```
   
   Create a `.env` file (optional):
   ```env
   PORT=5003
   WALLET_BACKEND_URL=http://localhost:5002
   ```

7. **Configure Issuer Environment Variables**
   Create a `.env` file in the `Issuer/` directory:
   ```env
   PORT=5001
   ISSUER_ADMIN_KEY=your-secret-admin-key
   ```

8. **Generate Issuer Keys**
   ```bash
   cd ../Issuer
   node issuerKeys.js
   ```

9. **Start All Services**
   
   **Terminal 1 - Blockchain:**
   ```bash
   cd Contracts
   npx hardhat node  # Keep running
   ```
   
   **Terminal 2 - Issuer Service:**
   ```bash
   cd Issuer
   node index.js
   ```
   
   **Terminal 3 - Wallet Backend:**
   ```bash
   cd WalletBackend
   node index.js
   ```
   
   **Terminal 4 - Verifier Backend:**
   ```bash
   cd Verifier
   node index.js
   ```

### Testing

1. **Test Issuer Registration and Credential Issuance**
   ```bash
   cd Issuer
   node tests/testIssuer.js
   node tests/testCredentialIssued.js
   ```

---

## 📖 API Documentation

Detailed API documentation with request/response examples for each service:

- **Issuer Backend:** [`Issuer/API.md`](Issuer/API.md)
- **Wallet Backend:** [`WalletBackend/API.md`](WalletBackend/API.md)
- **Verifier Backend:** [`Verifier/API.md`](Verifier/API.md)

Each API documentation includes:
- Complete endpoint descriptions
- Request/response formats
- cURL examples
- Error handling
- Authentication details

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
│   ├── artifacts/         # Compiled contracts
│   ├── cache/             # Hardhat cache
│   └── hardhat.config.js
│
├── Issuer/                # Issuer Backend
│   ├── API.md            # API documentation
│   ├── index.js          # Main server file
│   ├── contract.js       # Smart contract interaction
│   ├── keys.js           # Key management
│   ├── issuerKeys.js     # Key generation script
│   ├── issuer.json       # Generated issuer keys
│   └── tests/            # Test files
│       ├── testIssuer.js
│       └── testCredentialIssued.js
│
├── WalletBackend/         # Wallet Backend ✅ Implemented
│   ├── API.md            # API documentation
│   ├── index.js          # Main server file
│   ├── contract.js       # Smart contract interaction
│   ├── walletKeys.js     # Wallet key management
│   ├── wallet.json       # Generated wallet keys
│   └── storage.json      # Credential storage (created at runtime)
│
├── Verifier/              # Verifier Backend ✅ Implemented
│   ├── API.md            # API documentation
│   ├── index.js          # Main server file
│   └── contract.js       # Smart contract interaction
│
└── README.md              # This file
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
- [x] Wallet Backend
- [ ] Wallet UI
- [x] Verifier Backend
- [ ] Integration Testing
- [ ] Production Deployment Guide

---

**Note:** This is a proof-of-concept implementation. For production use, consider additional security measures, key management solutions, and compliance with relevant regulations (GDPR, etc.).

