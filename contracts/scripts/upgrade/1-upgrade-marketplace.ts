// scripts/upgrade/1-upgrade-marketplace.ts
import { ethers, upgrades } from "hardhat";

async function main() {
  console.log(
    "STEP 1: Upgrading BasedSeaMarketplace to add storage ownership transfer"
  );

  // IMPORTANT UPDATE THIS TO PRODUCTION VARS U RETARD
  // THESE SHOULD BE PROXY ADDRESSES
  const marketplaceAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  if (!marketplaceAddress) {
    throw new Error("MARKETPLACE_ADDRESS not found in .env file");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Check deployer is marketplace owner
  const marketplace = await ethers.getContractAt(
    "BasedSeaMarketplace",
    marketplaceAddress
  );
  const currentOwner = await marketplace.owner();

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Deployer is not the marketplace owner. Owner is: ${currentOwner}`
    );
  }

  // Upgrade marketplace
  console.log("Preparing marketplace upgrade...");
  const BasedSeaMarketplace = await ethers.getContractFactory(
    "BasedSeaMarketplace"
  );
  const upgradedMarketplace = await upgrades.upgradeProxy(
    marketplaceAddress,
    BasedSeaMarketplace
  );
  await upgradedMarketplace.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(
    marketplaceAddress
  );
  console.log("BasedSeaMarketplace upgraded successfully!");
  console.log("New implementation:", newImplementation);

  // Verify new function exists
  // Use bracket notation to bypass TypeScript checking
  if (
    typeof (upgradedMarketplace as any)["transferStorageOwnership"] ===
    "function"
  ) {
    console.log(
      "✅ transferStorageOwnership function exists in the upgraded contract"
    );
  } else {
    console.error(
      "❌ transferStorageOwnership function not found - upgrade may have failed!"
    );
  }

  console.log("\nStep 1 completed successfully. Proceed to step 2.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
  });
