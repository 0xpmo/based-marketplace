// scripts/upgrade/5-upgrade-marketplace-erc1155.ts
// npx hardhat run scripts/upgrade/5-upgrade-marketplace-erc1155.ts --network localhost
import { ethers, upgrades } from "hardhat";

async function main() {
  console.log(
    "STEP 5: Final upgrade of BasedSeaMarketplace with ERC1155 support"
  );

  // IMPORTANT UPDATE THIS TO PDOUCTION VARS U RETARD
  // THESE SHOULD BE PROXY ADDRESSES
  const marketplaceAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const storageAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  if (!marketplaceAddress) {
    throw new Error("MARKETPLACE_ADDRESS not specified");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Check deployer is marketplace owner
  const marketplace = await ethers.getContractAt(
    "BasedSeaMarketplace",
    marketplaceAddress
  );

  //   console.log("Marketplace contract address:", marketplaceAddress);
  //   try {
  //     const owner = await marketplace.owner();
  //     console.log("Owner:", owner);
  //   } catch (error) {
  //     console.error("Error fetching owner:", error);

  //     // Try to check if the contract exists
  //     const code = await ethers.provider.getCode(marketplaceAddress);
  //     console.log("Contract code exists:", code !== "0x");
  //   }
  const currentOwner = await marketplace.owner();

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Deployer is not the marketplace owner. Owner is: ${currentOwner}`
    );
  }

  // Upgrade marketplace with complete ERC1155 functionality
  console.log("Preparing final marketplace upgrade...");
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
  console.log(
    "BasedSeaMarketplace upgraded successfully with full ERC1155 support!"
  );
  console.log("New implementation:", newImplementation);

  // Verify ERC1155 functions exist
  if (typeof (upgradedMarketplace as any)["listERC1155Item"] === "function") {
    console.log("✅ listERC1155Item function exists in the upgraded contract");
  } else {
    console.error(
      "❌ listERC1155Item function not found - upgrade may have failed!"
    );
  }

  if (typeof (upgradedMarketplace as any)["buyERC1155Item"] === "function") {
    console.log("✅ buyERC1155Item function exists in the upgraded contract");
  } else {
    console.error(
      "❌ buyERC1155Item function not found - upgrade may have failed!"
    );
  }

  console.log(
    "\nStep 5 completed successfully. The upgrade process is now complete!"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
  });
