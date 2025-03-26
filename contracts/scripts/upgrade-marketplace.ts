import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Upgrading marketplace contracts...");

  // Get the proxy addresses from environment variables
  const marketplaceProxyAddress = process.env.MARKETPLACE_ADDRESS;
  const storageProxyAddress = process.env.MARKETPLACE_STORAGE_ADDRESS;

  if (!marketplaceProxyAddress || !storageProxyAddress) {
    throw new Error(
      "MARKETPLACE_ADDRESS and MARKETPLACE_STORAGE_ADDRESS environment variables must be set"
    );
  }

  console.log("Marketplace proxy address:", marketplaceProxyAddress);
  console.log("Storage proxy address:", storageProxyAddress);

  // Upgrade BasedMarketplaceStorage first (if a new version is available)
  if (process.env.UPGRADE_STORAGE === "true") {
    console.log("\n1. Upgrading BasedMarketplaceStorage...");
    const BasedMarketplaceStorageV2 = await ethers.getContractFactory(
      "BasedMarketplaceStorage"
    );

    // Perform the upgrade using UUPS pattern
    const upgradedStorage = await upgrades.upgradeProxy(
      storageProxyAddress,
      BasedMarketplaceStorageV2,
      { kind: "uups" }
    );

    await upgradedStorage.waitForDeployment();

    console.log("BasedMarketplaceStorage upgraded successfully");

    // Get the new implementation address
    const newStorageImplementation =
      await upgrades.erc1967.getImplementationAddress(storageProxyAddress);
    console.log(
      "New storage implementation address:",
      newStorageImplementation
    );
  } else {
    console.log("Skipping BasedMarketplaceStorage upgrade");
  }

  // Upgrade BasedMarketplace
  if (process.env.UPGRADE_MARKETPLACE === "true") {
    console.log("\n2. Upgrading BasedMarketplace...");
    const BasedMarketplaceV2 = await ethers.getContractFactory(
      "BasedMarketplace"
    );

    // Perform the upgrade using UUPS pattern
    const upgradedMarketplace = await upgrades.upgradeProxy(
      marketplaceProxyAddress,
      BasedMarketplaceV2,
      { kind: "uups" }
    );

    await upgradedMarketplace.waitForDeployment();

    console.log("BasedMarketplace upgraded successfully");

    // Get the new implementation address
    const newMarketplaceImplementation =
      await upgrades.erc1967.getImplementationAddress(marketplaceProxyAddress);
    console.log(
      "New marketplace implementation address:",
      newMarketplaceImplementation
    );
  } else {
    console.log("Skipping BasedMarketplace upgrade");
  }

  console.log("\nUpgrade process completed");
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
