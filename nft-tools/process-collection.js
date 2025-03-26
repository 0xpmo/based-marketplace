#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn, exec } = require("child_process");
const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");
const crypto = require("crypto");
const { ethers } = require("ethers");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("collection", {
    alias: "c",
    description: "Path to collection folder",
    type: "string",
    demandOption: true,
  })
  .option("deploy", {
    alias: "d",
    description: "Deploy the collection after processing",
    type: "boolean",
    default: false,
  })
  .option("network", {
    alias: "n",
    description: "Network to deploy to (local, testnet, mainnet)",
    type: "string",
    default: "local",
  })
  .help()
  .alias("help", "h").argv;

const COLLECTION_DIR = path.resolve(argv.collection);
const IMAGES_DIR = path.join(COLLECTION_DIR, "assets", "images");
const METADATA_DIR = path.join(COLLECTION_DIR, "assets", "metadata");
const CONFIG_FILE = path.join(COLLECTION_DIR, "collection-config.json");

// Load collection configuration
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
} catch (error) {
  console.error(`Error loading config file: ${error.message}`);
  process.exit(1);
}

// Ensure required directories exist
if (!fs.existsSync(METADATA_DIR)) {
  fs.mkdirSync(METADATA_DIR, { recursive: true });
}

// Initialize Pinata client
const pinataEndpoint = "https://api.pinata.cloud";
const pinataHeaders = {
  headers: {
    "Content-Type": "application/json",
    Authorization: config.pinata.jwt
      ? `Bearer ${config.pinata.jwt}`
      : undefined,
    pinata_api_key: config.pinata.api_key || undefined,
    pinata_secret_api_key: config.pinata.api_secret || undefined,
  },
};

// Helper function to upload to Pinata
async function uploadToPinata(file, isJson = false) {
  const formData = new FormData();

  if (isJson) {
    formData.append("file", JSON.stringify(file), {
      contentType: "application/json",
      filename: "metadata.json",
    });
  } else {
    formData.append("file", fs.createReadStream(file), {
      filepath: path.basename(file),
    });
  }

  try {
    const response = await axios.post(
      `${pinataEndpoint}/pinning/pinFileToIPFS`,
      formData,
      {
        maxContentLength: Infinity,
        headers: {
          ...pinataHeaders.headers,
          ...formData.getHeaders(),
        },
      }
    );

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error(`Error uploading to Pinata: ${error.message}`);
    throw error;
  }
}

// Process images and generate metadata
async function processCollection() {
  console.log("Processing collection...");

  // Get all image files
  const imageFiles = fs
    .readdirSync(IMAGES_DIR)
    .filter((file) => /\.(png|jpg|jpeg|gif)$/i.test(file))
    .sort((a, b) => {
      // Extract numbers from filenames for proper sorting
      const numA = parseInt(a.match(/\d+/) || 0);
      const numB = parseInt(b.match(/\d+/) || 0);
      return numA - numB;
    });

  if (imageFiles.length === 0) {
    console.error("No image files found in the images directory");
    process.exit(1);
  }

  const totalImages = imageFiles.length;
  console.log(`Found ${totalImages} images to process`);

  // Check if we have enough images for the collection
  if (totalImages < config.max_supply) {
    console.warn(
      `Warning: Only ${totalImages} images found, but max_supply is ${config.max_supply}`
    );
  }

  // Create a mapping of token IDs to metadata
  const metadataMapping = {};
  const ipfsImages = [];
  const metadataTemplate = JSON.parse(
    fs.readFileSync(path.join(METADATA_DIR, "metadata-template.json"), "utf8")
  );

  // Process each image
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const tokenId = i + 1; // Token IDs typically start at 1
    const imagePath = path.join(IMAGES_DIR, file);

    console.log(`Processing image ${tokenId}/${totalImages}: ${file}`);

    // Resize and optimize image if needed
    await sharp(imagePath)
      .resize(1024, 1024, { fit: "inside" })
      .toFile(path.join(METADATA_DIR, `temp_${file}`));

    // Upload image to IPFS
    console.log(`Uploading image ${tokenId} to IPFS...`);
    const imageIpfsUrl = await uploadToPinata(
      path.join(METADATA_DIR, `temp_${file}`)
    );
    ipfsImages.push({ tokenId, url: imageIpfsUrl });

    // Clean up temp file
    fs.unlinkSync(path.join(METADATA_DIR, `temp_${file}`));

    // Generate randomized metadata based on traits and rarities
    const metadata = JSON.parse(JSON.stringify(metadataTemplate));
    metadata.name = `${config.name} #${tokenId}`;
    metadata.description = config.description;
    metadata.image = imageIpfsUrl;
    metadata.external_url = `${config.external_link}/${tokenId}`;

    // Assign random traits based on config
    for (const trait in config.traits) {
      const values = config.traits[trait];
      let selectedValue;

      // Use rarity distributions if available
      if (config.rarities && config.rarities[trait]) {
        const rarities = config.rarities[trait];
        const totalWeight = Object.values(rarities).reduce(
          (sum, weight) => sum + weight,
          0
        );
        const random = Math.random() * totalWeight;

        let cumulativeWeight = 0;
        for (const [value, weight] of Object.entries(rarities)) {
          cumulativeWeight += weight;
          if (random <= cumulativeWeight) {
            selectedValue = value;
            break;
          }
        }
      } else {
        // Otherwise just pick randomly
        selectedValue = values[Math.floor(Math.random() * values.length)];
      }

      // Find the corresponding attribute and update it
      const attribute = metadata.attributes.find(
        (attr) => attr.trait_type === trait
      );
      if (attribute) {
        attribute.value = selectedValue;
      }
    }

    // Save metadata to file
    fs.writeFileSync(
      path.join(METADATA_DIR, `${tokenId}.json`),
      JSON.stringify(metadata, null, 2)
    );

    metadataMapping[tokenId] = metadata;

    // Add some delay to avoid rate limiting
    if (i < totalImages - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Create and upload collection metadata
  const collectionMetadata = {
    name: config.name,
    description: config.description,
    image: ipfsImages[0]?.url || "", // Use first image as collection image
    external_link: config.external_link,
    seller_fee_basis_points: config.seller_fee_basis_points,
    fee_recipient: config.fee_recipient,
  };

  fs.writeFileSync(
    path.join(METADATA_DIR, "collection.json"),
    JSON.stringify(collectionMetadata, null, 2)
  );

  console.log("Uploading collection metadata to IPFS...");
  const collectionIpfsUrl = await uploadToPinata(
    { ...collectionMetadata },
    true
  );

  // Upload all individual metadata files to IPFS
  console.log("Uploading all NFT metadata to IPFS...");

  // Create a directory for the final metadata
  const finalMetadataDir = path.join(METADATA_DIR, "final");
  if (!fs.existsSync(finalMetadataDir)) {
    fs.mkdirSync(finalMetadataDir, { recursive: true });
  }

  // Process metadata files for IPFS
  for (let i = 1; i <= totalImages; i++) {
    const metadata = metadataMapping[i];
    fs.writeFileSync(
      path.join(finalMetadataDir, `${i}.json`),
      JSON.stringify(metadata, null, 2)
    );
  }

  // Upload the whole metadata directory
  console.log("Creating metadata folder for IPFS...");
  const metadataIpfsUrl = await uploadFolderToPinata(finalMetadataDir);

  // Save the deployment information
  const deploymentInfo = {
    name: config.name,
    symbol: config.symbol,
    collectionUri: collectionIpfsUrl,
    metadataBaseUri: metadataIpfsUrl,
    maxSupply: config.max_supply,
    mintPrice: ethers.parseEther(config.mint_price.toString()).toString(),
    royaltyFee: config.seller_fee_basis_points,
    enableMinting: config.enable_minting,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(COLLECTION_DIR, "deployment-info.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Collection processing complete!");
  console.log(`Collection URI: ${collectionIpfsUrl}`);
  console.log(`Metadata Base URI: ${metadataIpfsUrl}`);

  return deploymentInfo;
}

// Function to upload a folder to Pinata
async function uploadFolderToPinata(folderPath) {
  const formData = new FormData();

  // Function to recursively add files from a folder
  function addFilesFromFolder(folderPath, formDataPath = "") {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        addFilesFromFolder(filePath, path.join(formDataPath, file));
      } else {
        formData.append("file", fs.createReadStream(filePath), {
          filepath: path.join(formDataPath, file),
        });
      }
    }
  }

  addFilesFromFolder(folderPath);

  try {
    const response = await axios.post(
      `${pinataEndpoint}/pinning/pinFileToIPFS`,
      formData,
      {
        maxContentLength: Infinity,
        headers: {
          ...pinataHeaders.headers,
          ...formData.getHeaders(),
        },
      }
    );

    return `ipfs://${response.data.IpfsHash}/`;
  } catch (error) {
    console.error(`Error uploading folder to Pinata: ${error.message}`);
    throw error;
  }
}

// Deploy the collection to the blockchain
async function deployCollection(deploymentInfo) {
  console.log("Deploying NFT collection to blockchain...");

  const deployCommand = `cd contracts && npx hardhat run scripts/deploy-collection.js --network ${argv.network}`;

  // Write deployment info to a temporary file that the deployment script can read
  fs.writeFileSync(
    path.join(__dirname, "..", "contracts", "deployment-info-temp.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  return new Promise((resolve, reject) => {
    exec(deployCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Deployment error: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Deployment stderr: ${stderr}`);
      }
      console.log(stdout);

      // Clean up temp file
      try {
        fs.unlinkSync(
          path.join(__dirname, "..", "contracts", "deployment-info-temp.json")
        );
      } catch (e) {
        console.warn("Could not delete temporary deployment file", e);
      }

      resolve(stdout);
    });
  });
}

// Main function
async function main() {
  try {
    const deploymentInfo = await processCollection();

    if (argv.deploy) {
      const deploymentResult = await deployCollection(deploymentInfo);
      console.log("Deployment completed successfully!");
    } else {
      console.log(
        "Collection processing completed. Use --deploy flag to deploy to blockchain."
      );
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
