// scripts/upgrade/4-return-storage-ownership.ts
import { ethers } from "hardhat";

async function main() {
  console.log("STEP 4: Returning storage ownership to marketplace");

  // IMPORTANT UPDATE THIS TO PDOUCTION VARS U RETARD
  // THESE SHOULD BE PROXY ADDRESSES
  const marketplaceAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const storageAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  if (!marketplaceAddress || !storageAddress) {
    throw new Error(
      "MARKETPLACE_ADDRESS or MARKETPLACE_STORAGE_ADDRESS not found in .env file"
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Get storage contract
  const storageContract = await ethers.getContractAt(
    "BasedSeaMarketplaceStorage",
    storageAddress
  );

  // Check initial ownership
  const initialStorageOwner = await storageContract.owner();
  console.log("Current storage owner:", initialStorageOwner);

  if (initialStorageOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      "Deployer is not the storage owner - cannot transfer ownership"
    );
  }

  // Transfer ownership back to marketplace
  console.log("Transferring storage ownership back to marketplace...");
  const tx = await storageContract.transferOwnership(marketplaceAddress);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();

  // Verify ownership change
  const newStorageOwner = await storageContract.owner();
  console.log("New storage owner:", newStorageOwner);

  if (newStorageOwner.toLowerCase() !== marketplaceAddress.toLowerCase()) {
    throw new Error(
      "Storage ownership transfer failed - marketplace is not the new owner"
    );
  }

  console.log("✅ Storage ownership returned to marketplace successfully");
  console.log("\nFull upgrade process completed successfully!");
  console.log("You can now use ERC1155 functionality in your marketplace!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
  });
