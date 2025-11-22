import express from "express";
import cors from "cors";
import crypto from "crypto";
import { SignJWT } from "jose";
import { contract } from "./contract.js";
import { issuerAddress, issuerPrivateKey } from "./keys.js";
import { ethers } from "ethers";


// RUN AT SERVER START
async function initializeIssuer() {
  console.log("Checking issuer registration on blockchain...");

  const isTrusted = await contract.isIssuerTrusted(issuerAddress);

  if (!isTrusted) {
    console.log("Issuer not registered. Registering now...");

    const tx = await contract.registerIssuer(issuerAddress);
    await tx.wait();

    console.log("Issuer successfully registered on blockchain.");
  } else {
    console.log("Issuer already registered. Skipping registration.");
  }
}



const app = express();
app.use(express.json());
app.use(cors());


app.post("/issue", async (req, res) => {
  try {
    const { name, dob, pan } = req.body;

    if (!name || !dob || !pan) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Create credential object
    const credential = {
      name,
      dob,
      pan,
      issuedAt: new Date().toISOString(),
    };

    // 1) Hash the credential
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(credential))
      .digest("hex");

    // 2) Sign the credential hash using Ethereum private key
    const wallet = new ethers.Wallet(issuerPrivateKey);
    const issuerSignature = await wallet.signMessage(hash);

    // 3) Prepare the Verifiable Credential (VC)
    const VC = {
      vc: credential,
      credentialHash: hash,
      issuerPublicKey: issuerAddress, // Ethereum-compatible
      issuerSignature: issuerSignature,
    };

    // 4) Store the credential hash on blockchain
    const padded = ethers.zeroPadValue("0x" + hash, 32);
    const tx = await contract.addCredential(padded);
    await tx.wait();

    return res.json(VC);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error issuing credential" });
  }
});


app.post("/revoke", async (req, res) => {
  try {
    const { credentialHash } = req.body;

    if (!credentialHash) {
      return res.status(400).json({ error: "Missing credentialHash" });
    }

    // Convert hash to bytes32 (padded)
    const padded = ethers.zeroPadValue("0x" + credentialHash, 32);

    // Call smart contract to revoke credential
    const tx = await contract.revokeCredential(padded);
    await tx.wait();

    return res.json({
      success: true,
      message: "Credential revoked on blockchain",
    });

  } catch (err) {
    console.error("Revoke error:", err);
    return res.status(500).json({ error: "Failed to revoke credential" });
  }
});


async function start() {
  try {
    console.log("Starting issuer service...");
    await initializeIssuer();
    console.log("Issuer service initialized");

    app.listen(5001, () => {
      console.log("Issuer service running on port 5001");
    });
  } catch (err) {
    console.error("Error during startup:", err);
  }
}

start();
