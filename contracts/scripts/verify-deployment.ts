// contracts/scripts/verify-deployment.ts
import { ethers } from "ethers";
import BasedCollectionFactoryArtifact from "../artifacts/contracts/BasedCollectionFactory.sol/BasedCollectionFactory.json";
import BasedMarketplaceArtifact from "../artifacts/contracts/BasedMarketplace.sol/BasedMarketplace.json";
import BasedMarketplaceStorageArtifact from "../artifacts/contracts/BasedMarketplaceStorage.sol/BasedMarketplaceStorage.json";
import BasedNFTCollectionArtifact from "../artifacts/contracts/BasedNFTCollection.sol/BasedNFTCollection.json";

async function main() {
  console.log("Verifying contract deployment...");

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const deployments = require("../ignition/deployments/chain-1337/deployed_addresses.json");

  const factory = new ethers.Contract(
    deployments["BasedMarketplace#BasedCollectionFactory"],
    BasedCollectionFactoryArtifact.abi,
    provider
  );

  const marketplaceStorage = new ethers.Contract(
    deployments["BasedMarketplace#BasedMarketplaceStorage"],
    BasedMarketplaceStorageArtifact.abi,
    provider
  );

  const marketplace = new ethers.Contract(
    deployments["BasedMarketplace#BasedMarketplace"],
    BasedMarketplaceArtifact.abi,
    provider
  );

  // Verify factory
  console.log("\nPepeCollectionFactory:");
  console.log(`- Address: ${await factory.getAddress()}`);
  console.log(
    `- Creation Fee: ${ethers.formatEther(await factory.creationFee())} ETH`
  );
  console.log(`- Fee Recipient: ${await factory.feeRecipient()}`);
  console.log(`- Owner: ${await factory.owner()}`);
  console.log(`- Collection Count: ${await factory.getCollectionCount()}`);

  // Verify marketplace storage
  console.log("\nPepeMarketplaceStorage:");
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
  console.log("\nPepeMarketplace:");
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
