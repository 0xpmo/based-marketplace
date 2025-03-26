import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying the entire BasedMarketplace ecosystem...");

  // Configuration parameters
  const DEFAULT_FEE = ethers.parseEther("0.001"); // 0.001 ETH factory creation fee
  const MARKET_FEE = 250; // 2.5% marketplace fee

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy Upgradeable BasedCollectionFactory
  console.log("\n1. Deploying upgradeable BasedCollectionFactory...");
  const BasedCollectionFactory = await ethers.getContractFactory(
    "BasedCollectionFactory"
  );

  const factoryProxy = await upgrades.deployProxy(
    BasedCollectionFactory,
    [DEFAULT_FEE, deployer.address],
    { initializer: "initialize" }
  );

  await factoryProxy.waitForDeployment();

  const factoryProxyAddress = await factoryProxy.getAddress();
  console.log("BasedCollectionFactory proxy deployed to:", factoryProxyAddress);

  // Get the implementation address
  const factoryImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(factoryProxyAddress);
  console.log(
    "BasedCollectionFactory implementation deployed to:",
    factoryImplementationAddress
  );

  // Get the admin address
  const factoryAdminAddress = await upgrades.erc1967.getAdminAddress(
    factoryProxyAddress
  );
  console.log("ProxyAdmin deployed to:", factoryAdminAddress);

  // 2. Deploy Upgradeable BasedMarketplaceStorage
  console.log("\n2. Deploying upgradeable BasedMarketplaceStorage...");
  const BasedMarketplaceStorage = await ethers.getContractFactory(
    "BasedMarketplaceStorage"
  );

  const storageProxy = await upgrades.deployProxy(BasedMarketplaceStorage, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await storageProxy.waitForDeployment();

  const storageAddress = await storageProxy.getAddress();
  console.log("BasedMarketplaceStorage proxy deployed to:", storageAddress);

  // Get the implementation address
  const storageImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(storageAddress);
  console.log(
    "BasedMarketplaceStorage implementation deployed to:",
    storageImplementationAddress
  );

  // 3. Deploy Upgradeable BasedMarketplace - with MODIFIED initialization
  console.log("\n3. Deploying upgradeable BasedMarketplace...");
  const BasedMarketplace = await ethers.getContractFactory("BasedMarketplace");

  // Create a custom initialize function that doesn't try to modify storage
  const marketplaceProxy = await upgrades.deployProxy(
    BasedMarketplace,
    [storageAddress],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await marketplaceProxy.waitForDeployment();

  const marketplaceAddress = await marketplaceProxy.getAddress();
  console.log("BasedMarketplace proxy deployed to:", marketplaceAddress);

  // Get the implementation address
  const marketplaceImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(marketplaceAddress);
  console.log(
    "BasedMarketplace implementation deployed to:",
    marketplaceImplementationAddress
  );

  // 4. Configure marketplace storage directly from the deployer
  console.log("\n4. Configuring marketplace storage values...");
  await storageProxy.setMarketFee(MARKET_FEE);
  await storageProxy.setPaused(false);
  await storageProxy.setRoyaltiesDisabled(false);
  console.log("Storage values configured");

  // 5. Transfer ownership of storage to marketplace
  console.log("\n5. Transferring ownership of storage to marketplace...");
  await storageProxy.transferOwnership(marketplaceAddress);
  console.log("Storage ownership transferred to marketplace");

  // 6. Create a sample collection (optional)
  console.log("\n6. Creating a sample collection...");
  await factoryProxy.createCollection(
    "Based Originals",
    "BASED",
    "ipfs://QmaSnsrEapbbgmhUmsQn74phTvuyNouicT9XWFaWGcJPeW",
    "ipfs://QmCollectionMetadata",
    ethers.parseEther("0.05"), // 0.05 ETH mint price
    100, // Max supply
    500, // 5% royalty
    true, // Enable minting
    { value: DEFAULT_FEE }
  );

  console.log("Sample collection created");

  // Summary
  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("BasedCollectionFactory Proxy: ", factoryProxyAddress);
  console.log(
    "BasedCollectionFactory Implementation: ",
    factoryImplementationAddress
  );
  console.log("BasedMarketplaceStorage Proxy: ", storageAddress);
  console.log(
    "BasedMarketplaceStorage Implementation: ",
    storageImplementationAddress
  );
  console.log("BasedMarketplace Proxy: ", marketplaceAddress);
  console.log(
    "BasedMarketplace Implementation: ",
    marketplaceImplementationAddress
  );
  console.log("\nDeployment completed successfully");

  // Save deployment addresses to .env.deployment file
  const envPath = path.join(__dirname, "../.env.deployment");
  const envContent =
    `# Deployment addresses - Created at ${new Date().toISOString()}\n` +
    `FACTORY_PROXY_ADDRESS=${factoryProxyAddress}\n` +
    `MARKETPLACE_ADDRESS=${marketplaceAddress}\n` +
    `MARKETPLACE_STORAGE_ADDRESS=${storageAddress}\n` +
    `FACTORY_IMPL_ADDRESS=${factoryImplementationAddress}\n` +
    `MARKETPLACE_IMPL_ADDRESS=${marketplaceImplementationAddress}\n` +
    `STORAGE_IMPL_ADDRESS=${storageImplementationAddress}\n`;

  fs.writeFileSync(envPath, envContent);
  console.log(`\nDeployment addresses saved to ${envPath}`);
  console.log("To use these addresses in subsequent scripts, run:");
  console.log(`export $(cat ${envPath} | grep -v '#' | xargs)`);
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
