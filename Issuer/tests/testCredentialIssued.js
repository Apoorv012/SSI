import { contract } from "../contract.js";
import { ethers } from "ethers";

const hash = "ad03103be790fddccca1e817c537fbede59a0d17668e49cf789e64f882413043";

const padded = ethers.zeroPadValue("0x" + hash, 32);

console.log("Issued:", await contract.isCredentialIssued(padded));
console.log("Revoked:", await contract.isCredentialRevoked(padded));
