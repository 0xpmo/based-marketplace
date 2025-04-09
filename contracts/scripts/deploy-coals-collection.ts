// Helper script to deploy whales collection
// TO RUN:
// First run create-whale-metadata.ts to create the metadata
// ### IMPORTANT: Then upload folder to pinata and copy and past folder cid into FOLDER_HASH
// npx hardhat run scripts/deploy-coals-collection.ts --network localhost
import { ethers } from "hardhat";
import { Log, EventLog } from "ethers";

// MAKE SURE THIS IS CORRECT YOU FUCKING IDIOT
const FACTORY_PROXY_ADDRESS = "0xEC6CAA8b24d96f0aD4dcC72Cf9DFF5e47F520eA0"; //process.env.FACTORY_PROXY_ADDRESS;
console.log("factory fucking address", FACTORY_PROXY_ADDRESS);
const FOLDER_HASH =
  "bafybeigggca7y5d7lcxpjbpkbsk66gx75ib6xjknkpelotyzzuqczza7w4"; // Folder hash from uploading folder to pinata

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n👤 Deploying with account:", deployer.address);

  if (!FOLDER_HASH) {
    throw new Error("Please set FOLDER_HASH environment variable");
  }

  const baseURI = `ipfs://${FOLDER_HASH}/`;
  const contractURI = `ipfs://${FOLDER_HASH}/collection`;

  console.log("\n📝 Collection configuration:");
  console.log("Base URI:", baseURI);
  console.log("Contract URI:", contractURI);

  const factory = await ethers.getContractAt(
    "BasedSeaCollectionFactory",
    FACTORY_PROXY_ADDRESS!
  );

  const DEFAULT_FEE = ethers.parseEther("100000");

  const unrevealedURI = `ipfs://${FOLDER_HASH}/unrevealed`;
  const mintPrice = ethers.parseEther("69000");
  const maxSupply = 2200;
  const maxTokensPerWallet = 50;
  const royaltyFee = 769;
  const mintingEnabled = true;
  const startRevealed = true;

  const currentNonce = await ethers.provider.getTransactionCount(
    deployer.address
  );

  console.log("\n🚀 Creating collection...");
  const tx = await factory.createCollection(
    "Pepe Rocks",
    "ROCK",
    baseURI,
    unrevealedURI,
    contractURI,
    mintPrice,
    maxSupply,
    maxTokensPerWallet,
    royaltyFee,
    mintingEnabled,
    startRevealed,
    {
      value: DEFAULT_FEE,
      gasPrice: 9,
      gasLimit: 5000000,
      nonce: currentNonce,
      // force: true,
    }
  );

  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();

  // Get collection address from event logs
  const event = receipt?.logs.find(
    (log: Log) =>
      log instanceof EventLog && log.eventName === "CollectionCreated"
  ) as EventLog;
  const owner = event?.args?.[0]; // First argument is the collection address
  const collectionAddress = event?.args?.[1]; // Second argument is the collection address
  const name = event?.args?.[2]; // Third argument is the collection name
  const symbol = event?.args?.[3]; // Fourth argument is the collection symbol

  console.log("\n✅ Collection created successfully!");
  console.log("Deployer address:", deployer.address);
  console.log("Owner address:", owner);
  console.log("Collection address:", collectionAddress);
  console.log("Name:", name);
  console.log("Symbol:", symbol);

  console.log("\nVerify contract:");
  console.log(`npx hardhat verify --network mainnet ${collectionAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
