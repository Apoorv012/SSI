import hre from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

async function main() {
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const registry = await hre.ethers.getContractAt(
    "SSIRegistry",
    contractAddress
  );

  // get signer
  const [owner] = await hre.ethers.getSigners();

  // 1. Register issuer
  const issuer = "0x000000000000000000000000000000000000dead";

  console.log("Registering issuer...");
  let tx = await registry.connect(owner).registerIssuer(issuer);
  await tx.wait();

  // Check
  const isTrusted = await registry.isIssuerTrusted(issuer);
  console.log("Is issuer trusted:", isTrusted);

  // 2. Revoke credential
  const credHash = keccak256(toUtf8Bytes("PAN-1234567890"));

  const isRevoked2 = await registry.isCredentialRevoked(credHash);
  console.log("Is credential revoked:", isRevoked2);

  console.log("Revoking credential...");
  let tx2 = await registry.connect(owner).revokeCredential(credHash);
  await tx2.wait();

  const isRevoked = await registry.isCredentialRevoked(credHash);
  console.log("Is credential revoked:", isRevoked);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
