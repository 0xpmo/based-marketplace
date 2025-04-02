// Helper script to deploy whales collection
// TO RUN:
// npx hardhat run scripts/local-deploy-whale-collection.ts --network localhost
import { ethers } from "hardhat";
import { Log, EventLog } from "ethers";

const FACTORY_PROXY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
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

  const DEFAULT_FEE = ethers.parseEther(".5");

  const unrevealedURI = `ipfs://${FOLDER_HASH}/unrevealed`;
  const mintPrice = ethers.parseEther("1");
  const maxSupply = 128;
  const maxTokensPerWallet = 5;
  const royaltyFee = 500;
  const mintingEnabled = true;
  const startRevealed = true;

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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
