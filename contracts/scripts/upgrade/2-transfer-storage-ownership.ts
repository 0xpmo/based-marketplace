// scripts/upgrade/2-transfer-storage-ownership.ts
import { ethers } from "hardhat";

async function main() {
  console.log("STEP 2: Transferring storage ownership to deployer");

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

  // Get contracts
  const marketplace = await ethers.getContractAt(
    "BasedSeaMarketplace",
    marketplaceAddress
  );
  const storageContract = await ethers.getContractAt(
    "BasedSeaMarketplaceStorage",
    storageAddress
  );

  // Check initial ownership
  const initialStorageOwner = await storageContract.owner();
  console.log("Current storage owner:", initialStorageOwner);

  if (initialStorageOwner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("Deployer is already the storage owner. No transfer needed.");
    return;
  }

  // Call transferStorageOwnership
  console.log("Transferring storage ownership to deployer...");
  const tx = await (marketplace as any).transferStorageOwnership(
    deployer.address
  );
  console.log("Transaction hash:", tx.hash);
  await tx.wait();

  // Verify ownership change
  const newStorageOwner = await storageContract.owner();
  console.log("New storage owner:", newStorageOwner);

  if (newStorageOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      "Storage ownership transfer failed - the deployer is not the new owner"
    );
  }

  console.log("✅ Storage ownership transferred to deployer successfully");
  console.log("\nStep 2 completed successfully. Proceed to step 3.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
  });
