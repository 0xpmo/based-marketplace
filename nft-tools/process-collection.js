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
  .option("local", {
    alias: "l",
    description: "Store files locally without uploading to IPFS",
    type: "boolean",
    default: false,
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

// Helper function to upload to Pinata or store locally
async function uploadToPinata(file, isJson = false) {
  // If using local storage, skip Pinata upload
  if (argv.local) {
    const filename = isJson
      ? `metadata-${crypto.randomBytes(8).toString("hex")}.json`
      : path.basename(file);

    const localStorageDir = path.join(COLLECTION_DIR, "local-storage");
    if (!fs.existsSync(localStorageDir)) {
      fs.mkdirSync(localStorageDir, { recursive: true });
    }

    const outputPath = path.join(localStorageDir, filename);

    if (isJson) {
      fs.writeFileSync(outputPath, JSON.stringify(file, null, 2));
    } else {
      fs.copyFileSync(file, outputPath);
    }

    // Return a pseudo-IPFS URL that points to the local file
    return `local://${filename}`;
  }

  // Otherwise, proceed with Pinata upload
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

    if (argv.local) {
      console.log("Falling back to local storage...");
      // Retry with local storage
      argv.local = true;
      return uploadToPinata(file, isJson);
    }

    throw error;
  }
}

// Process images and generate metadata
async function processCollection() {
  console.log("Processing collection...");

  // Check for banner and logo files specifically
  let bannerFile = null;
  let logoFile = null;

  // Check for files named banner.* or logo.* in the images directory
  fs.readdirSync(IMAGES_DIR).forEach((file) => {
    if (file.toLowerCase().startsWith("banner.")) {
      bannerFile = file;
    } else if (file.toLowerCase().startsWith("logo.")) {
      logoFile = file;
    }
  });

  // Get all image files (excluding banner and logo)
  const imageFiles = fs
    .readdirSync(IMAGES_DIR)
    .filter((file) => {
      // Filter by image extension and exclude banner and logo files
      return (
        /\.(png|jpg|jpeg|gif)$/i.test(file) &&
        file !== bannerFile &&
        file !== logoFile
      );
    })
    .sort((a, b) => {
      // Extract numbers from filenames for proper sorting
      const numA = parseInt(a.match(/\d+/) || 0);
      const numB = parseInt(b.match(/\d+/) || 0);
      return numA - numB;
    });

  if (imageFiles.length === 0) {
    console.error(
      "No image files found in the images directory (excluding banner and logo)"
    );
    process.exit(1);
  }

  const totalImages = imageFiles.length;
  console.log(
    `Found ${totalImages} NFT images to process (excluding banner and logo)`
  );

  // Check if we have enough images for the collection
  if (totalImages < config.max_supply) {
    console.warn(
      `Warning: Only ${totalImages} images found, but max_supply is ${config.max_supply}`
    );
  }

  // Make sure metadata template exists
  const metadataTemplatePath = path.join(
    METADATA_DIR,
    "metadata-template.json"
  );
  if (!fs.existsSync(metadataTemplatePath)) {
    console.error("Metadata template not found at: " + metadataTemplatePath);
    process.exit(1);
  }

  // Create a mapping of token IDs to metadata
  const metadataMapping = {};
  const ipfsImages = [];
  const metadataTemplate = JSON.parse(
    fs.readFileSync(metadataTemplatePath, "utf8")
  );

  // Upload logo and banner first if they exist
  let logoIpfsUrl = null;
  let bannerIpfsUrl = null;

  if (logoFile) {
    console.log(`Uploading collection logo: ${logoFile}`);
    logoIpfsUrl = await uploadToPinata(path.join(IMAGES_DIR, logoFile));
  }

  if (bannerFile) {
    console.log(`Uploading collection banner: ${bannerFile}`);
    bannerIpfsUrl = await uploadToPinata(path.join(IMAGES_DIR, bannerFile));
  }

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
    image: logoIpfsUrl || ipfsImages[0]?.url || "", // Use logo if available, otherwise first NFT
    banner_image_url: bannerIpfsUrl || "", // Use banner image if uploaded
    external_link: config.external_link,
    seller_fee_basis_points: config.seller_fee_basis_points,
    fee_recipient: config.fee_recipient,
    // Additional standard fields
    category: config.category || "art", // Default to art if not specified
    background_color: config.background_color || "", // Optional background color
    twitter_username: config.twitter_username || "",
    discord_url: config.discord_url || "",
    created_by: config.created_by || "",
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

  // Upload the metadata files
  console.log("Creating metadata folder for IPFS...");
  const metadataUrls = await uploadFolderToPinata(finalMetadataDir);

  // Get the manifest with all the token URIs
  const manifestPath = path.join(COLLECTION_DIR, "metadata-manifest.json");
  let tokenURIs = {};

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    tokenURIs = manifest.metadata_files || {};
  }

  // Save the deployment information
  const deploymentInfo = {
    name: config.name,
    symbol: config.symbol,
    contractURI: collectionIpfsUrl,
    metadataBaseUri: metadataUrls,
    tokenURIs: tokenURIs,
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
  console.log(`Metadata information saved to deployment-info.json`);

  return deploymentInfo;
}

// Function to upload a folder to Pinata
async function uploadFolderToPinata(folderPath) {
  try {
    console.log("Uploading metadata files individually...");
    const files = fs.readdirSync(folderPath);
    const metadataIpfsUrls = {};

    // Upload each metadata file individually
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(folderPath, file);
      const fileContent = JSON.parse(fs.readFileSync(filePath, "utf8"));

      console.log(`Uploading metadata file: ${file}`);
      const ipfsUrl = await uploadToPinata(fileContent, true);
      metadataIpfsUrls[file] = ipfsUrl;

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Create a manifest JSON file with links to all the metadata files
    const manifest = {
      name: config.name,
      description: `Metadata manifest for ${config.name}`,
      metadata_files: metadataIpfsUrls,
    };

    // Save the manifest locally for reference
    fs.writeFileSync(
      path.join(COLLECTION_DIR, "metadata-manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    console.log("Uploaded all metadata files individually");

    // Get the base CID from one of the uploaded files
    // Extract the base CID from the first IPFS URL to create a base URI
    const sampleIpfsUrl = Object.values(metadataIpfsUrls)[0];
    if (!sampleIpfsUrl) {
      throw new Error("No metadata files were uploaded successfully");
    }

    // Extract only the base CID part (ipfs://CID)
    const baseCid = sampleIpfsUrl.split("/")[2];
    const baseUri = `ipfs://${baseCid}/`;

    return baseUri;
  } catch (error) {
    console.error(`Error with metadata uploads: ${error.message}`);
    throw error;
  }
}

// Deploy the collection to the blockchain
async function deployCollection(deploymentInfo) {
  console.log("Deploying NFT collection to blockchain...");

  const deployCommand = `cd ../contracts && npx hardhat run scripts/deploy-collection.js --network ${argv.network}`;

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
