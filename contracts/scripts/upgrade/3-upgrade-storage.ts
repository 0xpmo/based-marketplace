// scripts/upgrade/3-upgrade-storage.ts
import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("STEP 3: Upgrading BasedSeaMarketplaceStorage");

  // IMPORTANT UPDATE THIS TO PDOUCTION VARS U RETARD
  // THESE SHOULD BE PROXY ADDRESSES
  const marketplaceAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const storageAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  if (!storageAddress) {
    throw new Error("MARKETPLACE_STORAGE_ADDRESS not found in .env file");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Check deployer is storage owner
  const storageContract = await ethers.getContractAt(
    "BasedSeaMarketplaceStorage",
    storageAddress
  );
  const currentOwner = await storageContract.owner();

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Deployer is not the storage owner. Owner is: ${currentOwner}`
    );
  }

  // Upgrade storage
  console.log("Preparing storage upgrade...");
  const BasedSeaMarketplaceStorage = await ethers.getContractFactory(
    "BasedSeaMarketplaceStorage"
  );
  const upgradedStorage = await upgrades.upgradeProxy(
    storageAddress,
    BasedSeaMarketplaceStorage
  );
  await upgradedStorage.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(
    storageAddress
  );
  console.log("BasedSeaMarketplaceStorage upgraded successfully!");
  console.log("New implementation:", newImplementation);

  // Verify new function exists
  if (typeof upgradedStorage.updateListingQuantity === "function") {
    console.log(
      "✅ updateListingQuantity function exists in the upgraded contract"
    );
  } else {
    console.error(
      "❌ updateListingQuantity function not found - upgrade may have failed!"
    );
  }

  console.log("\nStep 3 completed successfully. Proceed to step 4.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
  });
