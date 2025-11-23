// walletKeys.js
import fs from "fs-extra";
import { ethers } from "ethers";

const PATH = "./wallet.json";

export function ensureWallet() {
  if (fs.existsSync(PATH)) {
    const data = fs.readJsonSync(PATH);
    return data;
  }
  // create new random wallet (secp256k1)
  const wallet = ethers.Wallet.createRandom();
  const data = {
    privateKey: wallet.privateKey,
    address: wallet.address,
    publicKey: wallet.publicKey || null,
  };
  fs.writeJsonSync(PATH, data, { spaces: 2 });
  console.log("Created wallet backend key at", PATH);
  return data;
}
