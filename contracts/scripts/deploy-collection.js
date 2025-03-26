const fs = require("fs");
const path = require("path");
const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying NFT collection through BasedCollectionFactory...");

  // Load deployment info from the temp file
  const deploymentInfoPath = path.join(
    __dirname,
    "..",
    "deployment-info-temp.json"
  );

  if (!fs.existsSync(deploymentInfoPath)) {
    throw new Error(
      "Deployment info file not found. Run the process-collection.js script first."
    );
  }

  const deploymentInfo = JSON.parse(
    fs.readFileSync(deploymentInfoPath, "utf8")
  );

  console.log(
    `Deploying collection: ${deploymentInfo.name} (${deploymentInfo.symbol})`
  );
  console.log(`Metadata Base URI: ${deploymentInfo.metadataBaseUri}`);
  console.log(`Max Supply: ${deploymentInfo.maxSupply}`);
  console.log(
    `Mint Price: ${ethers.formatEther(deploymentInfo.mintPrice)} ETH`
  );
  console.log(`Royalty Fee: ${deploymentInfo.royaltyFee / 100}%`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from account: ${deployer.address}`);

  // Get the BasedCollectionFactory contract
  // First check if we have a factory address in the .env file or environment
  let factoryAddress = process.env.FACTORY_PROXY_ADDRESS;

  if (!factoryAddress) {
    try {
      // Try to load from .env.deployment
      const envPath = path.join(__dirname, "..", ".env.deployment");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        const factoryMatch = envContent.match(
          /FACTORY_PROXY_ADDRESS=(0x[a-fA-F0-9]{40})/
        );
        if (factoryMatch && factoryMatch[1]) {
          factoryAddress = factoryMatch[1];
        }
      }
    } catch (error) {
      console.warn(
        "Could not load factory address from .env.deployment",
        error
      );
    }
  }

  // If we still don't have a factory address, we'll need to create one
  if (!factoryAddress) {
    console.log(
      "Factory address not found. Deploying a new BasedCollectionFactory..."
    );

    // We need to use the proper creation fee that users pay to create collections
    const DEFAULT_FEE = ethers.parseEther("0.001"); // 0.001 ETH

    // Deploy factory as upgradeable contract
    const BasedCollectionFactory = await ethers.getContractFactory(
      "BasedCollectionFactory"
    );

    const factory = await upgrades.deployProxy(
      BasedCollectionFactory,
      [DEFAULT_FEE, deployer.address],
      { initializer: "initialize" }
    );

    await factory.waitForDeployment();
    factoryAddress = await factory.getAddress();

    console.log(`New BasedCollectionFactory deployed to: ${factoryAddress}`);

    // Save to .env.deployment
    const envContent = `# BasedCollectionFactory deployment\nFACTORY_PROXY_ADDRESS=${factoryAddress}\n`;
    fs.writeFileSync(path.join(__dirname, "..", ".env.deployment"), envContent);
  } else {
    console.log(`Using existing BasedCollectionFactory at: ${factoryAddress}`);
  }

  // Attach to the factory contract
  const factory = await ethers.getContractAt(
    "BasedCollectionFactory",
    factoryAddress
  );

  // Get the factory creation fee
  const creationFee = await factory.creationFee();
  console.log(`Factory creation fee: ${ethers.formatEther(creationFee)} ETH`);

  // Create the collection through the factory
  console.log("Creating collection through factory...");
  const tx = await factory.createCollection(
    deploymentInfo.name,
    deploymentInfo.symbol,
    deploymentInfo.collectionUri,
    deploymentInfo.mintPrice,
    deploymentInfo.maxSupply,
    deploymentInfo.royaltyFee,
    deploymentInfo.enableMinting,
    { value: creationFee }
  );

  console.log("Transaction submitted, waiting for confirmation...");
  const receipt = await tx.wait();

  // Extract the new collection address from the event
  const collectionCreatedEvent = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
      } catch (e) {
        return null;
      }
    })
    .find((event) => event && event.name === "CollectionCreated");

  if (!collectionCreatedEvent) {
    throw new Error(
      "Could not find CollectionCreated event in transaction receipt"
    );
  }

  const collectionAddress = collectionCreatedEvent.args.collection;
  console.log(`New collection deployed at: ${collectionAddress}`);

  // Save the collection address to the deployment info
  deploymentInfo.collectionAddress = collectionAddress;
  deploymentInfo.factoryAddress = factoryAddress;
  deploymentInfo.deployedAt = new Date().toISOString();
  deploymentInfo.deployerAddress = deployer.address;
  deploymentInfo.transactionHash = tx.hash;

  // Write the updated deployment info back to the temp file
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));

  // Save the collection address to a collections registry file
  const collectionsRegistryPath = path.join(
    __dirname,
    "..",
    "collections-registry.json"
  );
  let collectionsRegistry = {};

  if (fs.existsSync(collectionsRegistryPath)) {
    try {
      collectionsRegistry = JSON.parse(
        fs.readFileSync(collectionsRegistryPath, "utf8")
      );
    } catch (error) {
      console.warn("Could not parse collections registry file", error);
    }
  }

  collectionsRegistry[deploymentInfo.name] = {
    address: collectionAddress,
    name: deploymentInfo.name,
    symbol: deploymentInfo.symbol,
    collectionUri: deploymentInfo.collectionUri,
    metadataBaseUri: deploymentInfo.metadataBaseUri,
    maxSupply: deploymentInfo.maxSupply,
    mintPrice: deploymentInfo.mintPrice,
    royaltyFee: deploymentInfo.royaltyFee,
    deployedAt: deploymentInfo.deployedAt,
    deployerAddress: deploymentInfo.deployerAddress,
    transactionHash: deploymentInfo.transactionHash,
  };

  fs.writeFileSync(
    collectionsRegistryPath,
    JSON.stringify(collectionsRegistry, null, 2)
  );

  console.log("Collection deployment completed successfully!");
  console.log(`Collection Address: ${collectionAddress}`);
  console.log(`Collection URI: ${deploymentInfo.collectionUri}`);
  console.log(`Metadata Base URI: ${deploymentInfo.metadataBaseUri}`);

  // Provide some next steps
  console.log("\nNext steps:");
  console.log("1. Update your frontend to include the new collection");
  console.log(
    `2. Share the collection address (${collectionAddress}) with your users`
  );
  console.log(
    `3. Users can mint NFTs from the collection by calling the mint function`
  );

  return {
    collectionAddress,
    factoryAddress,
    deploymentInfo,
  };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
