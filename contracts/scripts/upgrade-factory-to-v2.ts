import { ethers, upgrades } from "hardhat";
import { BasedCollectionFactoryV2 } from "../typechain-types";

async function main() {
  console.log("Upgrading BasedCollectionFactory to V2...");

  // You'll need to replace this with the actual proxy address after initial deployment
  const proxyAddress = process.env.FACTORY_PROXY_ADDRESS;

  if (!proxyAddress) {
    throw new Error("FACTORY_PROXY_ADDRESS environment variable not set");
  }

  console.log("Proxy address:", proxyAddress);

  // Get the V2 contract factory
  const BasedCollectionFactoryV2Factory = await ethers.getContractFactory(
    "BasedCollectionFactoryV2"
  );

  // Perform the upgrade
  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    BasedCollectionFactoryV2Factory
  );

  await upgraded.waitForDeployment();

  console.log(
    "BasedCollectionFactory upgraded to V2 at address:",
    await upgraded.getAddress()
  );

  // Get the new implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log("New implementation address:", implementationAddress);

  // Set up a trusted creator as an example
  const [deployer, creator] = await ethers.getSigners();

  // Cast the contract to the V2 type to access new methods
  const factoryV2 = upgraded as unknown as BasedCollectionFactoryV2;

  // First set the discount percentage (default is 50%)
  console.log("Setting discount percentage to 30%...");
  await factoryV2.setDiscountPercentage(3000); // 30.00%

  // Then set a trusted creator
  console.log("Setting trusted creator:", creator.address);
  await factoryV2.setTrustedCreator(creator.address, true);

  console.log("Upgrade and initialization complete");
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
