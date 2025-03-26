import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Upgrading BasedCollectionFactory...");

  // You'll need to replace this with the actual proxy address after initial deployment
  const proxyAddress = process.env.FACTORY_PROXY_ADDRESS;

  if (!proxyAddress) {
    throw new Error("FACTORY_PROXY_ADDRESS environment variable not set");
  }

  console.log("Proxy address:", proxyAddress);

  // Get the upgraded contract factory
  const BasedCollectionFactory = await ethers.getContractFactory(
    "BasedCollectionFactory"
  );

  // Perform the upgrade
  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    BasedCollectionFactory
  );

  await upgraded.waitForDeployment();

  console.log(
    "BasedCollectionFactory upgraded successfully at address:",
    await upgraded.getAddress()
  );

  // Get the new implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log("New implementation address:", implementationAddress);
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
