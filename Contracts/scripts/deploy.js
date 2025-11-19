import hre from "hardhat";

async function main() {
  const SSIRegistry = await hre.ethers.getContractFactory("SSIRegistry");
  const registry = await SSIRegistry.deploy();

  await registry.waitForDeployment(); // wait for the deployment to be confirmed

  console.log("Deployed at:", await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
