import { ethers } from "ethers";
import fs from "fs";

const wallet = ethers.Wallet.createRandom();

const data = {
  privateKey: wallet.privateKey,
  publicKey: wallet.publicKey,
  address: wallet.address
};

fs.writeFileSync("issuer.json", JSON.stringify(data, null, 2));

console.log("Issuer wallet generated:");
console.log(data);
