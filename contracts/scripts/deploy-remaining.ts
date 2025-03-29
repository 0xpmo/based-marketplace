import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying the BasedSeaMarketplace contract only...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Reference the already deployed contracts
  const factoryProxyAddress = "0xEC6CAA8b24d96f0aD4dcC72Cf9DFF5e47F520eA0";
  const storageAddress = "0xD1141e0AA6deD15Ae4DBa5F280b5b24CD69F2B3d";
  console.log("Using storage contract at:", storageAddress);

  // Get the implementation addresses (for summary at the end)
  const factoryImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(factoryProxyAddress);
  const storageImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(storageAddress);

  // First, clear the OpenZeppelin manifest to avoid "already known" issues
  //   console.log("Clearing previous deployment records...");
  //   if (fs.existsSync(".openzeppelin")) {
  //     fs.rmSync(".openzeppelin", { recursive: true, force: true });
  //     console.log(".openzeppelin directory cleared");
  //   }

  // Deploy the marketplace with the correct gas settings
  console.log("\nDeploying BasedSeaMarketplace...");
  const BasedSeaMarketplace = await ethers.getContractFactory(
    "BasedSeaMarketplace"
  );

  const marketplaceProxy = await upgrades.deployProxy(
    BasedSeaMarketplace,
    [storageAddress],
    {
      initializer: "initialize",
      kind: "uups",
      txOverrides: {
        gasPrice: 9,
        gasLimit: 5000000,
      },
    }
  );

  await marketplaceProxy.waitForDeployment();
  const marketplaceAddress = await marketplaceProxy.getAddress();
  console.log("BasedSeaMarketplace proxy deployed to:", marketplaceAddress);

  // Get the implementation address
  const marketplaceImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(marketplaceAddress);
  console.log(
    "BasedSeaMarketplace implementation deployed to:",
    marketplaceImplementationAddress
  );

  // Configure marketplace storage directly from the deployer
  console.log("\nConfiguring marketplace storage values...");
  const MARKET_FEE = 450; // 4.5% marketplace fee
  const storageProxy = await ethers.getContractAt(
    "BasedSeaMarketplaceStorage",
    storageAddress
  );

  await storageProxy.setMarketFee(MARKET_FEE, {
    gasPrice: 9,
    gasLimit: 5000000,
  });

  console.log("Storage values configured");
  console.log(
    "Market fees are accumulated in the contract until withdrawn by the owner"
  );

  // Transfer ownership of storage to marketplace
  console.log("\nTransferring ownership of storage to marketplace...");
  await storageProxy.transferOwnership(marketplaceAddress, {
    gasPrice: 9,
    gasLimit: 5000000,
  });

  console.log("Storage ownership transferred to marketplace");

  // Print deployment summary
  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("BasedCollectionFactory Proxy: ", factoryProxyAddress);
  console.log(
    "BasedSeaCollectionFactory Implementation: ",
    factoryImplementationAddress
  );
  console.log("BasedSeaMarketplaceStorage Proxy: ", storageAddress);
  console.log(
    "BasedSeaMarketplaceStorage Implementation: ",
    storageImplementationAddress
  );
  console.log("BasedSeaMarketplace Proxy: ", marketplaceAddress);
  console.log(
    "BasedSeaMarketplace Implementation: ",
    marketplaceImplementationAddress
  );
  console.log("\nDeployment completed successfully");

  // Update .env file with new addresses
  console.log("\nUpdating .env file...");
  const envPath = path.join(__dirname, "../.env");
  let envContent = "";

  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  // Update or add each address
  const updates = {
    FACTORY_PROXY_ADDRESS: factoryProxyAddress,
    MARKETPLACE_ADDRESS: marketplaceAddress,
    MARKETPLACE_STORAGE_ADDRESS: storageAddress,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (envContent.includes(key)) {
      // Replace existing line
      envContent = envContent.replace(
        new RegExp(`${key}=.*`, "g"),
        `${key}=${value}`
      );
    } else {
      // Add new line
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Updated .env file with new addresses");

  console.log(`\nDeployment addresses saved to ${envPath}`);
  console.log("To use these addresses in subsequent scripts, run:");
  console.log(`export $(cat ${envPath} | grep -v '#' | xargs)`);
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
