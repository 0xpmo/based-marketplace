// contracts/scripts/verify-deployment.ts
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import BasedCollectionFactoryArtifact from "../artifacts/contracts/BasedCollectionFactory.sol/BasedCollectionFactory.json";
import BasedMarketplaceArtifact from "../artifacts/contracts/BasedMarketplace.sol/BasedMarketplace.json";
import BasedMarketplaceStorageArtifact from "../artifacts/contracts/BasedMarketplaceStorage.sol/BasedMarketplaceStorage.json";
import BasedNFTCollectionArtifact from "../artifacts/contracts/BasedNFTCollection.sol/BasedNFTCollection.json";

// Load environment variables from .env.deployment if it exists
const deploymentEnvPath = path.join(__dirname, "../.env.deployment");
if (fs.existsSync(deploymentEnvPath)) {
  console.log(`Loading deployment addresses from ${deploymentEnvPath}`);
  dotenv.config({ path: deploymentEnvPath });
}

async function main() {
  console.log("Verifying contract deployment...");

  // Get RPC URL based on network
  const network =
    process.argv.find((arg) => arg.startsWith("--network="))?.split("=")[1] ||
    process.argv[process.argv.indexOf("--network") + 1] ||
    "localhost";

  const rpcUrl =
    network === "localhost"
      ? "http://127.0.0.1:8545"
      : process.env.BASED_AI_RPC_URL || "";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Try to get addresses from environment variables first (for upgradeable deployments)
  let factoryAddress = process.env.FACTORY_PROXY_ADDRESS || "";
  let marketplaceAddress = process.env.MARKETPLACE_ADDRESS || "";
  let storageAddress = process.env.MARKETPLACE_STORAGE_ADDRESS || "";

  // If environment variables aren't set, try to get from deployment file (for Ignition deployments)
  if (!factoryAddress || !marketplaceAddress || !storageAddress) {
    console.log(
      "Environment variables not found, checking Ignition deployments..."
    );

    // Determine chain ID based on network
    const chainId = network === "localhost" ? "1337" : "84532"; // 84532 is Based chain ID

    const deploymentsPath = path.join(
      __dirname,
      `../ignition/deployments/chain-${chainId}/deployed_addresses.json`
    );

    if (fs.existsSync(deploymentsPath)) {
      const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
      factoryAddress =
        deployments["BasedMarketplace#BasedCollectionFactory"] || "";
      marketplaceAddress =
        deployments["BasedMarketplace#BasedMarketplace"] || "";
      storageAddress =
        deployments["BasedMarketplace#BasedMarketplaceStorage"] || "";

      console.log("Using addresses from Ignition deployment");
    } else {
      console.error(
        "No deployment addresses found. Please set environment variables or deploy using Ignition first."
      );
      process.exit(1);
    }
  } else {
    console.log("Using addresses from environment variables");
  }

  // Verify all addresses are present
  if (!factoryAddress || !marketplaceAddress || !storageAddress) {
    console.error(
      "One or more contract addresses are missing. Cannot proceed with verification."
    );
    process.exit(1);
  }

  console.log(`Network: ${network}`);
  console.log(`Factory Address: ${factoryAddress}`);
  console.log(`Marketplace Address: ${marketplaceAddress}`);
  console.log(`Storage Address: ${storageAddress}`);

  const factory = new ethers.Contract(
    factoryAddress,
    BasedCollectionFactoryArtifact.abi,
    provider
  );

  const marketplaceStorage = new ethers.Contract(
    storageAddress,
    BasedMarketplaceStorageArtifact.abi,
    provider
  );

  const marketplace = new ethers.Contract(
    marketplaceAddress,
    BasedMarketplaceArtifact.abi,
    provider
  );

  // Verify factory
  console.log("\nBasedCollectionFactory:");
  console.log(`- Address: ${await factory.getAddress()}`);
  console.log(
    `- Creation Fee: ${ethers.formatEther(await factory.creationFee())} ETH`
  );
  console.log(`- Fee Recipient: ${await factory.feeRecipient()}`);
  console.log(`- Owner: ${await factory.owner()}`);
  console.log(`- Collection Count: ${await factory.getCollectionCount()}`);

  // Verify marketplace storage
  console.log("\nBasedMarketplaceStorage:");
  console.log(`- Address: ${await marketplaceStorage.getAddress()}`);
  console.log(
    `- Market Fee: ${await marketplaceStorage.marketFee()} basis points (${Number(
      ((await marketplaceStorage.marketFee()) * BigInt(100)) / BigInt(10000)
    )}%)`
  );
  console.log(`- Owner: ${await marketplaceStorage.owner()}`);
  console.log(`- Paused: ${await marketplaceStorage.paused()}`);
  console.log(
    `- Royalties Disabled: ${await marketplaceStorage.royaltiesDisabled()}`
  );

  // Verify marketplace
  console.log("\nBasedMarketplace:");
  console.log(`- Address: ${await marketplace.getAddress()}`);
  console.log(`- Storage Contract: ${await marketplace.marketplaceStorage()}`);
  console.log(`- Owner: ${await marketplace.owner()}`);

  // Verify collections
  const collections = await factory.getCollections();
  console.log("\nDeployed Collections:");

  for (let i = 0; i < collections.length; i++) {
    const collectionAddress = collections[i];
    const collection = new ethers.Contract(
      collectionAddress,
      BasedNFTCollectionArtifact.abi,
      provider
    );

    console.log(`\nCollection ${i + 1}:`);
    console.log(`- Address: ${collectionAddress}`);
    console.log(`- Name: ${await collection.name()}`);
    console.log(`- Symbol: ${await collection.symbol()}`);
    console.log(`- Collection URI: ${await collection.collectionURI()}`);
    console.log(
      `- Mint Price: ${ethers.formatEther(await collection.mintPrice())} ETH`
    );
    console.log(`- Max Supply: ${await collection.maxSupply()}`);
    console.log(`- Total Minted: ${await collection.totalMinted()}`);
    console.log(
      `- Royalty Fee: ${await collection.royaltyFee()} basis points (${Number(
        ((await collection.royaltyFee()) * BigInt(100)) / BigInt(10000)
      )}%)`
    );
    console.log(`- Minting Enabled: ${await collection.mintingEnabled()}`);
    console.log(`- Owner: ${await collection.owner()}`);
  }

  console.log("\nDeployment verification completed successfully!");
}

main().catch((error) => {
  console.error("Deployment verification failed:", error);
  process.exitCode = 1;
});
