// Helper script to deploy whales collection
// TO RUN:
// First run create-whale-metadata.ts to create the metadata
// ### IMPORTANT: Then upload folder to pinata and copy and past folder cid into FOLDER_HASH
// npx hardhat run scripts/deploy-whale-collection.ts --network localhost
import { ethers } from "hardhat";
import { Log, EventLog } from "ethers";

// MAKE SURE THIS IS CORRECT YOU FUCKING IDIOT
const FACTORY_PROXY_ADDRESS = "0xEC6CAA8b24d96f0aD4dcC72Cf9DFF5e47F520eA0"; //process.env.FACTORY_PROXY_ADDRESS;
console.log("factory fucking address", FACTORY_PROXY_ADDRESS);
const FOLDER_HASH =
  "bafybeias5ai3i2f5gcrjiun6ekk4vjhebtyhyo7cy6wkfvmv2dcvlv5cwu"; // Folder hash from uploading folder to pinata

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
  const mintPrice = ethers.parseEther("10000");
  const maxSupply = 128;
  const maxTokensPerWallet = 5;
  const royaltyFee = 500;
  const mintingEnabled = false;
  const startRevealed = true;

  const currentNonce = await ethers.provider.getTransactionCount(
    deployer.address
  );

  console.log("\n🚀 Creating collection...");
  const tx = await factory.createCollection(
    "Based Whales",
    "WHALE",
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
