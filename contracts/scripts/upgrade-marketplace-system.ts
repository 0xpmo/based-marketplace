// scripts/upgrade-marketplace-system.ts
import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  console.log("Starting marketplace system upgrade...");

  // IMPORTANT UPDATE THIS TO PDOUCTION VARS U RETARD
  // THESE SHOULD BE PROXY ADDRESSES
  const marketplaceAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const storageAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  if (!marketplaceAddress || !storageAddress) {
    throw new Error(
      "MARKETPLACE_ADDRESS or MARKETPLACE_STORAGE_ADDRESS not found in .env file"
    );
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  // Step 1: Check and temporarily transfer Storage contract ownership if needed
  console.log("\n1. Checking storage contract ownership...");
  const storageContract = await ethers.getContractAt(
    "BasedSeaMarketplaceStorage",
    storageAddress
  );
  const currentStorageOwner = await storageContract.owner();

  let ownershipTransferred = false;

  if (currentStorageOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(
      `Storage is currently owned by ${currentStorageOwner}, not by deployer ${deployer.address}`
    );
    console.log("Temporarily transferring storage ownership to deployer...");

    // Call transferOwnership directly on the storage contract
    await storageContract.transferOwnership(deployer.address);
    console.log("Storage ownership transferred to deployer");
    ownershipTransferred = true;
  } else {
    console.log(
      "Storage is already owned by the deployer, proceeding with upgrade"
    );
  }

  // Step 2: Upgrade the Storage contract
  console.log("\n2. Upgrading BasedSeaMarketplaceStorage...");
  const BasedSeaMarketplaceStorage = await ethers.getContractFactory(
    "BasedSeaMarketplaceStorage"
  );

  console.log("Preparing storage upgrade...");
  const upgradedStorage = await upgrades.upgradeProxy(
    storageAddress,
    BasedSeaMarketplaceStorage
  );
  await upgradedStorage.waitForDeployment();

  // Get the new implementation address
  const newStorageImplementation =
    await upgrades.erc1967.getImplementationAddress(storageAddress);
  console.log("BasedSeaMarketplaceStorage upgraded successfully!");
  console.log("New storage implementation:", newStorageImplementation);

  // Step 3: Upgrade the Marketplace contract
  console.log("\n3. Upgrading BasedSeaMarketplace...");
  const BasedSeaMarketplace = await ethers.getContractFactory(
    "BasedSeaMarketplace"
  );

  console.log("Preparing marketplace upgrade...");
  const upgradedMarketplace = await upgrades.upgradeProxy(
    marketplaceAddress,
    BasedSeaMarketplace
  );
  await upgradedMarketplace.waitForDeployment();

  // Get the new implementation address
  const newMarketplaceImplementation =
    await upgrades.erc1967.getImplementationAddress(marketplaceAddress);
  console.log("BasedSeaMarketplace upgraded successfully!");
  console.log("New marketplace implementation:", newMarketplaceImplementation);

  // Step 4: If we transferred ownership, transfer it back to the marketplace
  if (ownershipTransferred) {
    console.log("\n4. Transferring storage ownership back to marketplace...");
    // Call transferOwnership on the upgraded storage contract to give ownership back to marketplace
    await upgradedStorage.transferOwnership(marketplaceAddress);
    console.log(
      `Storage ownership transferred back to marketplace at ${marketplaceAddress}`
    );
  }

  console.log("\nUpgrade process completed successfully!");
  console.log("Summary:");
  console.log(
    "- BasedSeaMarketplaceStorage new implementation:",
    newStorageImplementation
  );
  console.log(
    "- BasedSeaMarketplace new implementation:",
    newMarketplaceImplementation
  );
  console.log("\nYou can now use ERC1155 functionality in your marketplace!");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
