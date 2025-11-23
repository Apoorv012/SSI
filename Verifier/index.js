// index.js
import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { contract } from "./contract.js";

dotenv.config();

const WALLET_BACKEND = process.env.WALLET_BACKEND_URL || "http://localhost:5002";
const PORT = process.env.PORT || 5003;

const app = express();
app.use(express.json());
app.use(cors());

/**
 * Helper: normalize hex hash (strip or add 0x)
 */
function normalizeHash(hex) {
  if (!hex) return null;
  if (hex.startsWith("0x")) return hex.slice(2);
  return hex;
}

/**
 * Helper: pad hash to bytes32 (ethers expects 0x-prefixed Bytes)
 */
function paddedHashBytes32(hex) {
  const clean = normalizeHash(hex);
  // zeroPadValue expects 0x + hex string representing bytes
  return ethers.zeroPadValue("0x" + clean, 32);
}

/**
 * 1) /send-request
 * The verifier asks the Wallet Backend to request proof from the holder.
 * Body: { verifierId, attributes: [...], issuerPublicKey? }
 */
app.post("/send-request", async (req, res) => {
  try {
    const { verifierId, attributes, issuerPublicKey } = req.body;

    // Debug to print out incoming /send-request payload
    console.log("Received /send-request payload:", {
        verifierId,
        attributes,
        issuerPublicKey
      });

    if (!verifierId || !Array.isArray(attributes)) {
      return res.status(400).json({ error: "Missing verifierId or attributes" });
    }
    

    // Forward to wallet backend
    const resp = await axios.post(`${WALLET_BACKEND}/request-proof`, {
      verifierId,
      attributes,
      issuerPublicKey: issuerPublicKey || null
    });

    return res.json({ ok: true, data: resp.data });
  } catch (err) {
    console.error("send-request error:", err?.response?.data || err.message);
    return res.status(500).json({ error: "Failed to send request" });
  }
});

/**
 * 2) /poll-request/:id
 * Poll the wallet backend for the request status and VP (if approved).
 */
app.get("/poll-request/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const resp = await axios.get(`${WALLET_BACKEND}/requests/${id}`);
    return res.json({ ok: true, data: resp.data });
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ error: "Request not found on wallet backend" });
    }
    console.error("poll-request error:", err?.response?.data || err.message);
    return res.status(500).json({ error: "Failed to poll request" });
  }
});

/**
 * 3) /verify-vp
 * Verifier provides a VP (verifiable presentation) and this endpoint runs a full verification:
 *   - backendSignature (recover and compare with backend.address)
 *   - issuerSignature (recover and compare with issuerPublicKey)
 *   - on-chain checks: isIssuerTrusted, isCredentialIssued, !isCredentialRevoked
 *
 * Body: { vp: { ... } }  (the VP object returned by wallet backend)
 */
app.post("/verify-vp", async (req, res) => {
  try {
    const { vp } = req.body;
    if (!vp) return res.status(400).json({ error: "Missing vp" });

    // Basic shape checks
    const { vp: derived, credentialHash, issuerPublicKey, issuerSignature, backend, backendSignature } = vp;
    if (!credentialHash || !issuerPublicKey || !issuerSignature || !backend || !backendSignature) {
      return res.status(400).json({ error: "Malformed VP: missing fields" });
    }

    // 1) Verify backend signature (vpPayload stringified)
    const vpPayload = {
      vp: derived,
      credentialHash,
      issuerPublicKey,
      issuerSignature,
      backend,
      requestId: vp.requestId,
      verifierId: vp.verifierId
    };

    const vpString = JSON.stringify(vpPayload);
    let recoveredBackendAddress;
    try {
      recoveredBackendAddress = ethers.verifyMessage(vpString, backendSignature);
    } catch (e) {
      return res.status(400).json({ error: "Invalid backend signature format" });
    }

    if (recoveredBackendAddress.toLowerCase() !== backend.address.toLowerCase()) {
      return res.status(400).json({ error: "Backend signature does not match backend.address" });
    }

    // 2) Verify issuer signature — issuer signed the credentialHash
    // We expect issuerSignature = signMessage(credentialHash) performed by issuer
    let recoveredIssuer;
    try {
      recoveredIssuer = ethers.verifyMessage(credentialHash, issuerSignature);
    } catch (e) {
      return res.status(400).json({ error: "Invalid issuer signature format" });
    }

    if (recoveredIssuer.toLowerCase() !== issuerPublicKey.toLowerCase()) {
      return res.status(400).json({ error: "Issuer signature does not match issuer public key" });
    }

    // 3) On-chain checks: issuer trusted, credential issued, not revoked
    const padded = paddedHashBytes32(credentialHash);

    const isTrusted = await contract.isIssuerTrusted(issuerPublicKey);
    if (!isTrusted) {
      return res.status(400).json({ error: "Issuer not trusted on-chain" });
    }

    const issued = await contract.isCredentialIssued(padded);
    if (!issued) {
      return res.status(400).json({ error: "Credential not recorded as issued on-chain" });
    }

    const revoked = await contract.isCredentialRevoked(padded);
    if (revoked) {
      return res.status(400).json({ error: "Credential has been revoked" });
    }

    // 4) (Optional) Additional checks you can perform:
    //   - ensure derived attributes are consistent with credential (if you have access to VC)
    //   - check timestamps, reuse prevention, etc.

    // All checks passed
    return res.json({
      ok: true,
      message: "VP verified successfully",
      details: {
        backendAddress: recoveredBackendAddress,
        issuerAddress: recoveredIssuer,
        onChain: { isTrusted, issued, revoked },
        derived
      }
    });
  } catch (err) {
    console.error("verify-vp error:", err);
    return res.status(500).json({ error: "Failed to verify VP" });
  }
});

app.listen(PORT, () => {
  console.log(`Verifier backend running on port ${PORT}`);
});
