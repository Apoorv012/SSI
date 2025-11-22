import { contract } from "../contract.js";
import { issuerAddress } from "../keys.js";

const trusted = await contract.isIssuerTrusted(issuerAddress);
console.log("Is Issuer Trusted:", trusted);
