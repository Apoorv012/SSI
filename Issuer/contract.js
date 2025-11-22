import { ethers } from "ethers";
import fs from "fs";

// -----------------------------
// 1. Load ABI from Hardhat build
// -----------------------------
const contractJson = JSON.parse(
  fs.readFileSync(
    "../Contracts/artifacts/contracts/SSIRegistry.sol/SSIRegistry.json",
    "utf8"
  )
);

// -----------------------------
// 2. Smart Contract Address 
//    (from your Hardhat deployment)
// -----------------------------
export const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // replace if redeployed

// -----------------------------
// 3. Connect to Hardhat Local Node
// -----------------------------
export const provider = new ethers.JsonRpcProvider(
  "http://127.0.0.1:8545"
);

// -----------------------------
// 4. Use Hardhat Account #0 as Owner
// -----------------------------
// ✔ This key appears in your Hardhat node console when you run:
//    npx hardhat node
//
// IMPORTANT: Replace the string below with your actual Hardhat private key.
// -----------------------------
export const OWNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// -----------------------------
// 5. Create Signer (Account that calls the contract)
// -----------------------------
export const signer = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

// -----------------------------
// 6. Create Contract Instance
// -----------------------------
export const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  contractJson.abi,
  signer
);

// You're ready to call:
// contract.registerIssuer()
// contract.addCredential()
// contract.revokeCredential()
// contract.isIssuerTrusted()
// contract.isCredentialIssued()
// contract.isCredentialRevoked()
