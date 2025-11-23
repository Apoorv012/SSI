// index.js
import express from "express";
import cors from "cors";
import fs from "fs-extra";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { ethers } from "ethers";
import { ensureWallet } from "./walletKeys.js";
import { contract } from "./contract.js";

const STORAGE_PATH = "./storage.json";

// Ensure simple persistent storage exists
function ensureStorage() {
  if (!fs.existsSync(STORAGE_PATH)) {
    const init = { credentials: {}, requests: {} };
    fs.writeJsonSync(STORAGE_PATH, init, { spaces: 2 });
    return init;
  }
  return fs.readJsonSync(STORAGE_PATH);
}

const storage = ensureStorage();
const walletData = ensureWallet();

const app = express();
app.use(express.json());
app.use(cors());

// helper to persist storage
function saveStorage() {
  fs.writeJsonSync(STORAGE_PATH, storage, { spaces: 2 });
}

/**
 * POST /store-credential
 * Body: { vc: { vc, credentialHash, issuerPublicKey, issuerSignature } }
 * Validates everything BEFORE storing.
 */
app.post("/store-credential", async (req, res) => {
  try {
    const { vc } = req.body;

    if (!vc || !vc.credentialHash || !vc.issuerPublicKey || !vc.issuerSignature) {
      return res.status(400).json({ error: "Invalid VC payload" });
    }

    const credentialHash = vc.credentialHash;
    const issuerAddress = vc.issuerPublicKey;
    const issuerSignature = vc.issuerSignature;

    // 1) Recompute hash of credential payload
    const computedHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(vc.vc)) // ONLY the vc.vc object (actual credential)
      .digest("hex");

    if (computedHash !== credentialHash) {
      return res.status(400).json({ error: "Credential hash mismatch" });
    }

    // 2) Verify issuer signature -> must recover issuerAddress
    let recovered;
    try {
      recovered = ethers.verifyMessage(credentialHash, issuerSignature);
    } catch (e) {
      return res.status(400).json({ error: "Invalid issuer signature format" });
    }

    if (recovered.toLowerCase() !== issuerAddress.toLowerCase()) {
      return res.status(400).json({ 
        error: "Issuer signature does not match provided issuer public key"
      });
    }

    // 3) Blockchain checks
    const paddedHash = ethers.zeroPadValue("0x" + credentialHash, 32);

    // is issuer trusted?
    const trusted = await contract.isIssuerTrusted(issuerAddress);
    if (!trusted) {
      return res.status(400).json({ error: "Issuer is NOT trusted on-chain" });
    }

    // is credential issued?
    const issued = await contract.isCredentialIssued(paddedHash);
    if (!issued) {
      return res.status(400).json({ 
        error: "Credential hash not found on blockchain (not issued by issuer)" 
      });
    }

    // is credential revoked?
    const revoked = await contract.isCredentialRevoked(paddedHash);
    if (revoked) {
      return res.status(400).json({ 
        error: "Credential has been revoked on-chain" 
      });
    }

    // 4) Finally, store the credential locally in wallet backend storage
    storage.credentials[credentialHash] = {
      vc,
      storedAt: new Date().toISOString(),
    };

    saveStorage();

    return res.json({
      ok: true,
      stored: true,
      message: "Credential successfully validated and stored",
    });

  } catch (err) {
    console.error("Store credential error:", err);
    return res.status(500).json({ error: "Internal error storing credential" });
  }
});


/**
 * GET /credentials
 * List stored credentials
 */
app.get("/credentials", (req, res) => {
  return res.json(storage.credentials);
});

/**
 * POST /request-proof
 * Verifier calls this to request attributes.
 * Body: { verifierId: "Bank-123", attributes: ["over18","panLast4"], credentialHash }
 * Returns requestId
 */
app.post("/request-proof", (req, res) => {
  const { verifierId, attributes, credentialHash } = req.body;
  if (!verifierId || !Array.isArray(attributes) || !credentialHash) {
    return res.status(400).json({ error: "Missing fields (verifierId, attributes, credentialHash)" });
  }
  // ensure credential exists
  if (!storage.credentials[credentialHash]) {
    return res.status(404).json({ error: "Credential not found in wallet" });
  }
  const requestId = uuidv4();
  storage.requests[requestId] = {
    id: requestId,
    verifierId,
    attributes,
    credentialHash,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  saveStorage();
  // In a real system you would push a websocket/notification to wallet UI.
  return res.json({ ok: true, requestId });
});

/**
 * GET /pending-requests
 * For Wallet UI to poll and show approvals
 */
app.get("/pending-requests", (req, res) => {
  const list = Object.values(storage.requests).filter(r => r.status === "pending");
  return res.json(list);
});

/**
 * POST /respond
 * Body: { requestId, approve: true/false }
 * If approved: create VP, sign it with backend key, return VP object.
 */
app.post("/respond", async (req, res) => {
  try {
    const { requestId, approve } = req.body;
    if (!requestId || typeof approve !== "boolean") {
      return res.status(400).json({ error: "Missing requestId or approve (boolean)" });
    }
    const reqObj = storage.requests[requestId];
    if (!reqObj) return res.status(404).json({ error: "Request not found" });
    if (reqObj.status !== "pending") return res.status(400).json({ error: "Request already handled" });

    if (!approve) {
      reqObj.status = "rejected";
      reqObj.resolvedAt = new Date().toISOString();
      saveStorage();
      return res.json({ ok: true, message: "Request rejected" });
    }

    // APPROVAL FLOW:
    const credentialHash = reqObj.credentialHash;
    const stored = storage.credentials[credentialHash];
    if (!stored) return res.status(404).json({ error: "Credential not found" });

    const vc = stored.vc; // this is the object issued by Issuer

    // Validate issuer and credential on-chain BEFORE creating VP
    const padded = ethers.zeroPadValue("0x" + vc.credentialHash, 32);
    const issuerAddress = vc.issuerPublicKey; // the issuer address stored in VC

    // 1) is issuer trusted?
    const isTrusted = await contract.isIssuerTrusted(issuerAddress);
    if (!isTrusted) {
      return res.status(400).json({ error: "Issuer not trusted on chain" });
    }
    // 2) is credential issued?
    const isIssued = await contract.isCredentialIssued(padded);
    if (!isIssued) {
      return res.status(400).json({ error: "Credential not recorded as issued on chain" });
    }
    // 3) is credential revoked?
    const isRevoked = await contract.isCredentialRevoked(padded);
    if (isRevoked) {
      return res.status(400).json({ error: "Credential has been revoked" });
    }

    // Derive requested attributes from the stored VC
    const derived = {};
    for (const attr of reqObj.attributes) {
      if (attr === "over18") {
        const dob = vc.vc.dob; // format YYYY-MM-DD
        const age = computeAge(dob);
        derived.over18 = age >= 18;
      } else if (attr === "panLast4") {
        const pan = vc.vc.pan || "";
        derived.panLast4 = pan.slice(-4);
      } else if (attr === "name") {
        derived.name = vc.vc.name;
      } else {
        // unsupported attribute -> include raw if present (for POC)
        derived[attr] = vc.vc[attr];
      }
    }

    // Create VP (Verifiable Presentation)
    const vpPayload = {
      vp: derived,
      credentialHash: vc.credentialHash,
      issuerPublicKey: issuerAddress,
      issuerSignature: vc.issuerSignature,
      backend: {
        address: walletData.address,
        timestamp: new Date().toISOString(),
      },
      requestId: requestId,
      verifierId: reqObj.verifierId
    };

    // Sign VP with backend wallet private key (Ethereum style)
    const wallet = new ethers.Wallet(walletData.privateKey);
    // We sign the canonical JSON string
    const vpString = JSON.stringify(vpPayload);
    const backendSignature = await wallet.signMessage(vpString);

    const VP = {
      ...vpPayload,
      backendSignature
    };

    // mark request as completed and store VP for audit
    reqObj.status = "approved";
    reqObj.resolvedAt = new Date().toISOString();
    reqObj.vp = VP;
    saveStorage();

    // Return VP to verifier (in real flow you may POST to verifier callback)
    return res.json({ ok: true, vp: VP });

  } catch (err) {
    console.error("Respond error:", err);
    return res.status(500).json({ error: "Failed to respond to request" });
  }
});

// utility: compute age from YYYY-MM-DD
function computeAge(dobStr) {
  try {
    const [y, m, d] = dobStr.split("-").map(Number);
    const dob = new Date(y, m - 1, d);
    const diff = Date.now() - dob.getTime();
    const age_dt = new Date(diff);
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  } catch (e) {
    return null;
  }
}

/**
 * GET /requests/:id
 * fetch a handled request (for verifier to poll)
 */
app.get("/requests/:id", (req, res) => {
  const id = req.params.id;
  const r = storage.requests[id];
  if (!r) return res.status(404).json({ error: "Not found" });
  return res.json(r);
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log("Wallet backend running on port", PORT);
});
