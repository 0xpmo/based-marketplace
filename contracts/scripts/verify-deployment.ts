// contracts/scripts/verify-deployment.ts
import { ethers } from "ethers";
import PepeCollectionFactoryArtifact from "../artifacts/contracts/PepeCollectionFactory.sol/PepeCollectionFactory.json";
import PepeMarketplaceArtifact from "../artifacts/contracts/PepeMarketplace.sol/PepeMarketplace.json";
import PepeNFTCollectionArtifact from "../artifacts/contracts/PepeNFTCollection.sol/PepeNFTCollection.json";

async function main() {
  console.log("Verifying contract deployment...");

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const deployments = require("../ignition/deployments/chain-1337/deployed_addresses.json");

  const factory = new ethers.Contract(
    deployments["PepeMarketplace#PepeCollectionFactory"],
    PepeCollectionFactoryArtifact.abi,
    provider
  );

  const marketplace = new ethers.Contract(
    deployments["PepeMarketplace#PepeMarketplace"],
    PepeMarketplaceArtifact.abi,
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

  // Verify marketplace
  console.log("\nPepeMarketplace:");
  console.log(`- Address: ${await marketplace.getAddress()}`);
  console.log(
    `- Market Fee: ${await marketplace.marketFee()} basis points (${Number(
      ((await marketplace.marketFee()) * BigInt(100)) / BigInt(10000)
    )}%)`
  );
  console.log(`- Owner: ${await marketplace.owner()}`);

  // Verify collections
  const collections = await factory.getCollections();
  console.log("\nDeployed Collections:");

  for (let i = 0; i < collections.length; i++) {
    const collectionAddress = collections[i];
    const collection = new ethers.Contract(
      collectionAddress,
      PepeNFTCollectionArtifact.abi,
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
