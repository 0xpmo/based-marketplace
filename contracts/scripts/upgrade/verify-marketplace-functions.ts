// scripts/upgrade/verify-marketplace-functions.ts
// npx hardhat run scripts/upgrade/verify-marketplace-functions.ts --network localhost
import { ethers } from "hardhat";
import { FunctionFragment } from "ethers";

async function main() {
  console.log(
    "Verifying if ERC1155 functions already exist in marketplace contract"
  );

  const marketplaceAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  if (!marketplaceAddress) {
    throw new Error("MARKETPLACE_ADDRESS not specified");
  }

  // Connect to the marketplace contract
  const marketplace = await ethers.getContractAt(
    "BasedSeaMarketplace",
    marketplaceAddress
  );

  // Get the contract's ABI
  const abi = marketplace.interface.fragments;

  // Function names to check
  const erc1155Functions = [
    "listERC1155Item",
    "buyERC1155Item",
    "cancelERC1155Listing",
    "updateERC1155ListingPriceAndQuantity",
  ];

  // Check each function
  console.log("\nChecking for ERC1155 functions:");

  let allFunctionsExist = true;
  for (const funcName of erc1155Functions) {
    // Check if function exists in ABI
    const functionExists = abi.some((fragment) => {
      if (fragment.type === "function") {
        // Cast to FunctionFragment which has a name property
        const funcFragment = fragment as FunctionFragment;
        return funcFragment.name === funcName;
      }
      return false;
    });

    // Also try the direct method check
    const runtimeExists = typeof (marketplace as any)[funcName] === "function";

    if (functionExists || runtimeExists) {
      console.log(`✅ ${funcName}: EXISTS`);
    } else {
      console.log(`❌ ${funcName}: MISSING`);
      allFunctionsExist = false;
    }
  }

  // Check implementation address
  const implementationAddress = await ethers.provider.getStorage(
    marketplaceAddress,
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  );

  console.log("\nImplementation address:", implementationAddress);

  // Conclusion
  if (allFunctionsExist) {
    console.log(
      "\n✅ CONCLUSION: The marketplace contract ALREADY HAS ERC1155 functionality."
    );
    console.log("You can skip Step 5 (final upgrade).");
  } else {
    console.log(
      "\n❗ CONCLUSION: The marketplace contract NEEDS the final upgrade (Step 5)."
    );
    console.log("Proceed with running the final upgrade script.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
  });
