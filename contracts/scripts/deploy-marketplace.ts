import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying the entire BasedSeaMarketplace ecosystem...");

  // Configuration parameters
  const DEFAULT_FEE = 100000000000000000000000; // 100 basedAI (100,000 based) creation fee //ethers.parseEther("0.001"); // 0.001 ETH factory creation fee
  const MARKET_FEE = 450; // 4.5% marketplace fee

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy Upgradeable BasedSeaCollectionFactory
  console.log("\n1. Deploying upgradeable BasedSeaCollectionFactory...");
  const BasedSeaCollectionFactory = await ethers.getContractFactory(
    "BasedSeaCollectionFactory"
  );

  const factoryProxy = await upgrades.deployProxy(
    BasedSeaCollectionFactory,
    [DEFAULT_FEE, deployer.address],
    { initializer: "initialize" }
  );

  await factoryProxy.waitForDeployment();

  const factoryProxyAddress = await factoryProxy.getAddress();
  console.log(
    "BasedSeaCollectionFactory proxy deployed to:",
    factoryProxyAddress
  );

  // Get the implementation address
  const factoryImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(factoryProxyAddress);
  console.log(
    "BasedSeaCollectionFactory implementation deployed to:",
    factoryImplementationAddress
  );

  // Get the admin address
  const factoryAdminAddress = await upgrades.erc1967.getAdminAddress(
    factoryProxyAddress
  );
  console.log("ProxyAdmin deployed to:", factoryAdminAddress);

  // 2. Deploy Upgradeable BasedSeaMarketplaceStorage
  console.log("\n2. Deploying upgradeable BasedSeaMarketplaceStorage...");
  const BasedSeaMarketplaceStorage = await ethers.getContractFactory(
    "BasedSeaMarketplaceStorage"
  );

  // Initialize with fee recipient (deployer address)
  const storageProxy = await upgrades.deployProxy(
    BasedSeaMarketplaceStorage,
    [deployer.address], // Pass fee recipient
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await storageProxy.waitForDeployment();

  const storageAddress = await storageProxy.getAddress();
  console.log("BasedSeaMarketplaceStorage proxy deployed to:", storageAddress);

  // Get the implementation address
  const storageImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(storageAddress);
  console.log(
    "BasedSeaMarketplaceStorage implementation deployed to:",
    storageImplementationAddress
  );

  // 3. Deploy Upgradeable BasedSeaMarketplace
  console.log("\n3. Deploying upgradeable BasedSeaMarketplace...");
  const BasedSeaMarketplace = await ethers.getContractFactory(
    "BasedSeaMarketplace"
  );

  const marketplaceProxy = await upgrades.deployProxy(
    BasedSeaMarketplace,
    [storageAddress], // Pass storage address
    {
      initializer: "initialize",
      kind: "uups",
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

  // 4. Configure marketplace storage directly from the deployer
  console.log("\n4. Configuring marketplace storage values...");
  await storageProxy.setMarketFee(MARKET_FEE);
  await storageProxy.setPaused(false);
  await storageProxy.setRoyaltiesDisabled(false);
  console.log("Storage values configured");
  console.log(
    "Market fees are accumulated in the contract until withdrawn by the owner"
  );

  // 5. Transfer ownership of storage to marketplace
  console.log("\n5. Transferring ownership of storage to marketplace...");
  await storageProxy.transferOwnership(marketplaceAddress);
  console.log("Storage ownership transferred to marketplace");

  // 6. Create a sample collection (optional)
  // console.log("\n6. Creating a sample collection...");
  // await factoryProxy.createCollection(
  //   "Based Originals",
  //   "BASED",
  //   "ipfs://QmaSnsrEapbbgmhUmsQn74phTvuyNouicT9XWFaWGcJPeW",
  //   "ipfs://QmCollectionMetadata",
  //   ethers.parseEther("0.05"), // 0.05 ETH mint price
  //   100, // Max supply
  //   10, // Max tokens per wallet (new parameter)
  //   500, // 5% royalty - now expecting uint96
  //   true, // Enable minting
  //   true, // Start revealed
  //   { value: DEFAULT_FEE }
  // );
  //   console.log("Sample collection created");

  // Summary
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
