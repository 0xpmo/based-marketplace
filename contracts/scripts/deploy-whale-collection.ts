// Helper script to deploy whales collection
// TO RUN:
// First run create-whale-metadata.ts to create the metadata
// Then upload folder to pinata and copy and past folder cid into FOLDER_HASH
// npx hardhat run scripts/deploy-whale-collection.ts --network localhost
import { ethers } from "hardhat";
import { Log, EventLog } from "ethers";

const FACTORY_PROXY_ADDRESS = process.env.FACTORY_PROXY_ADDRESS;
const FOLDER_HASH =
  "bafybeigq2srkxjonstwtjfadu6gapoyks3jfi3libvr2oo5uvuag2zs5qe"; // Folder hash from uploading folder to pinata

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
    "BasedCollectionFactory",
    FACTORY_PROXY_ADDRESS!
  );

  const DEFAULT_FEE = ethers.parseEther("0.001");

  console.log("\n🚀 Creating collection...");
  const tx = await factory.createCollection(
    "Based Whales",
    "WHALE",
    baseURI,
    contractURI,
    ethers.parseEther("0.05"),
    4,
    500,
    true,
    { value: DEFAULT_FEE }
  );

  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();

  // Get collection address from event logs
  const event = receipt?.logs.find(
    (log: Log) =>
      log instanceof EventLog && log.eventName === "CollectionCreated"
  ) as EventLog;
  const collectionAddress = event?.args?.[0]; // First argument is the collection address

  console.log("\n✅ Collection created successfully!");
  console.log("Collection address:", collectionAddress);
  console.log("Owner address:", deployer.address);
  console.log("\nVerify contract:");
  console.log(`npx hardhat verify --network mainnet ${collectionAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
