import fs from "fs";
const keyData = JSON.parse(fs.readFileSync("./issuer.json"));

export const issuerPrivateKey = keyData.privateKey;
export const issuerPublicKey = keyData.publicKey;
export const issuerAddress   = keyData.address;
