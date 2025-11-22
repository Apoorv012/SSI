import { contract } from "../contract.js";
import { ethers } from "ethers";

const hash = "98e68a1640fb4f3f64f5be0dc41797ee182c784516b0fcb3d980827a30dc93ed";

const padded = ethers.zeroPadValue("0x" + hash, 32);

console.log("Issued:", await contract.isCredentialIssued(padded));
console.log("Revoked:", await contract.isCredentialRevoked(padded));
