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
      ...vc,
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
 * Body: {
 *   verifierId: "BankXYZ",
 *   attributes: ["over18", "panLast4"],
 *   issuerPublicKey: "0x123..."   // optional
 * }
 */
app.post("/request-proof", (req, res) => {
  const { verifierId, attributes, issuerPublicKey } = req.body;

  if (!verifierId || !Array.isArray(attributes)) {
    return res.status(400).json({ error: "Missing verifierId or attributes" });
  }

  const requestId = uuidv4();

  storage.requests[requestId] = {
    id: requestId,
    verifierId,
    attributes,
    issuerPublicKey: issuerPublicKey || null,    // optional filter
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  saveStorage();
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
 * Select a credential capable of fulfilling the request
 * (with optional issuer filter)
 */
function findMatchingCredential(attributes, issuerFilter) {
  const allCreds = Object.values(storage.credentials);

  for (const cred of allCreds) {
    // 1) issuer filter
    if (issuerFilter && cred.issuerPublicKey !== issuerFilter) {
      continue;
    }

    // 2) check if credential contains all required fields
    let ok = true;
    for (const attr of attributes) {
      if (attr === "over18" && cred.vc["dob"] !== undefined) continue; // derived
      if (attr === "panLast4" && cred.vc["pan"] !== undefined) continue; // derived
      if (cred.vc[attr] === undefined) {
        ok = false;
        break;
      }
    }

    if (ok) return cred;
  }

  return null;
}


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
 * POST /respond
 * Body: { requestId, approve: true/false }
 * If approved: auto-select a credential, validate on-chain, derive attributes,
 * create VP, sign it, and return it.
 */
app.post("/respond", async (req, res) => {
  try {
    const { requestId, approve } = req.body;

    if (!requestId || typeof approve !== "boolean") {
      return res.status(400).json({ error: "Missing requestId or approve (boolean)" });
    }

    const reqObj = storage.requests[requestId];
    if (!reqObj) return res.status(404).json({ error: "Request with the given requestId not found" });

    if (reqObj.status !== "pending") {
      return res.status(400).json({ 
        error: "Request already handled",
        status: reqObj.status
      });
    }

    // === CASE: User Rejects ===
    if (!approve) {
      reqObj.status = "rejected";
      reqObj.resolvedAt = new Date().toISOString();
      saveStorage();
      return res.json({ ok: true, message: "Request rejected" });
    }

    // === CASE: User Approves ===
    const { attributes, issuerPublicKey } = reqObj;

    // AUTO-SELECT CREDENTIAL
    const selectedVC = findMatchingCredential(attributes, issuerPublicKey);

    if (!selectedVC) {
      return res.status(400).json({
        error: "No credential in wallet can fulfill the requested attributes",
      });
    }

    const vc = selectedVC;  // actual VC object
    const credentialHash = vc.credentialHash;
    const issuerAddress = vc.issuerPublicKey;

    // VALIDATE ON-CHAIN BEFORE CREATING VP
    const padded = ethers.zeroPadValue("0x" + credentialHash, 32);

    // is issuer trusted?
    const trusted = await contract.isIssuerTrusted(issuerAddress);
    if (!trusted) {
      return res.status(400).json({ error: "Issuer is NOT trusted on-chain" });
    }

    // is credential issued?
    const issued = await contract.isCredentialIssued(padded);
    if (!issued) {
      return res.status(400).json({ 
        error: "Credential hash not found on blockchain (not issued)" 
      });
    }

    // is credential revoked?
    const revoked = await contract.isCredentialRevoked(padded);
    if (revoked) {
      return res.status(400).json({ error: "Credential is revoked" });
    }

    // DERIVE REQUESTED ATTRIBUTES
    const derived = {};
    for (const attr of attributes) {
      if (attr === "over18") {
        const dob = vc.vc.dob;
        const age = computeAge(dob);
        console.log(`Computed Age: ${age}`)
        derived.over18 = age >= 18;
      } 
      else if (attr === "panLast4") {
        const pan = vc.vc.pan || "";
        derived.panLast4 = pan.slice(-4);
      }
      else if (attr in vc.vc) {
        derived[attr] = vc.vc[attr];
      }
      else {
        return res.status(400).json({ 
          error: `Attribute '${attr}' cannot be derived from selected credential`
        });
      }
    }

    // CREATE V.P. PAYLOAD
    const vpPayload = {
      vp: derived,
      credentialHash, // credentialHash of the original document
      issuerPublicKey: issuerAddress, // issuer of the original document
      issuerSignature: vc.issuerSignature,
      backend: {
        address: walletData.address,
        timestamp: new Date().toISOString(),
      },
      requestId,
      verifierId: reqObj.verifierId,
    };

    // SIGN V.P. WITH BACKEND PRIVATE KEY
    const wallet = new ethers.Wallet(walletData.privateKey);
    const vpString = JSON.stringify(vpPayload);     // canonical serialization
    const backendSignature = await wallet.signMessage(vpString);

    const VP = {
      ...vpPayload,
      backendSignature,
    };

    // UPDATE STORAGE
    reqObj.status = "approved";
    reqObj.resolvedAt = new Date().toISOString();
    reqObj.vp = VP;
    saveStorage();

    // RETURN TO VERIFIER
    return res.json({ ok: true, vp: VP });

  } catch (err) {
    console.error("Respond error:", err);
    return res.status(500).json({ error: "Failed to respond to request" });
  }
});


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
