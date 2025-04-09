// Helper script to create metadata for NFT collection
// TO RUN:
// npx hardhat run scripts/create-nft-metadata.ts --network localhost
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

// You'll need to add these environment variables
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

// Add this as a configurable constant at the top of the file
const COLLECTION_PREFIX = "pepe-rocks-"; // Change this for your collection name

// Path to your NFT assets - update this to your folder path
const IMAGES_PATH = path.join(
  process.env.HOME || "~",
  "Desktop/nft-collection/upload-images"
);
const METADATA_PATH = path.join(
  process.env.HOME || "~",
  "Desktop/nft-collection/upload-metadata"
);

// Total number of NFTs in your collection
const TOTAL_NFTS = 2200;

async function uploadToPinataWithRetry(
  content: any,
  fileName: string,
  isRawFile = false,
  retries = 3
): Promise<string> {
  // Add the collection prefix to the filename for Pinata
  const prefixedFileName = COLLECTION_PREFIX + fileName;

  for (let i = 0; i < retries; i++) {
    try {
      if (isRawFile) {
        // For raw files like images, use pinFileToIPFS with prefixed filename
        const formData = new FormData();
        formData.append("file", content, prefixedFileName);

        console.log(
          `Uploading file ${prefixedFileName}... (attempt ${i + 1}/${retries})`
        );
        const response = await axios.post(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              pinata_api_key: PINATA_API_KEY!,
              pinata_secret_api_key: PINATA_SECRET_KEY!,
            },
            maxBodyLength: Infinity,
          }
        );
        console.log(`✓ Successfully uploaded ${prefixedFileName}`);
        return response.data.IpfsHash;
      } else {
        // For JSON data, use pinJSONToIPFS
        console.log(
          `Uploading JSON ${prefixedFileName}... (attempt ${i + 1}/${retries})`
        );
        const response = await axios.post(
          "https://api.pinata.cloud/pinning/pinJSONToIPFS",
          content,
          {
            headers: {
              "Content-Type": "application/json",
              pinata_api_key: PINATA_API_KEY!,
              pinata_secret_api_key: PINATA_SECRET_KEY!,
            },
          }
        );
        console.log(`✓ Successfully uploaded ${prefixedFileName}`);
        return response.data.IpfsHash;
      }
    } catch (error) {
      console.log(`✗ Failed to upload ${prefixedFileName} (attempt ${i + 1})`);
      if (i === retries - 1) throw error;
    }
  }
  throw new Error(
    `Failed to upload ${prefixedFileName} after ${retries} attempts`
  );
}

// Function to read and clean up the metadata
function readAndCleanMetadata(tokenId: number): any {
  const metadataFilePath = path.join(METADATA_PATH, `${tokenId}.json`);
  const rawMetadata = JSON.parse(fs.readFileSync(metadataFilePath, "utf-8"));

  // Create a cleaned version with only the fields we want
  const cleanedMetadata = {
    name: rawMetadata.name,
    image: `${tokenId}.png`, // Will be replaced with IPFS CID later
    attributes: rawMetadata.attributes,
  };

  return cleanedMetadata;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n👤 Creating collection with account:", deployer.address);

  // Read and clean all metadata files
  console.log("\n📑 Processing existing metadata files...");
  const tokenMetadata: any[] = [];

  for (let i = 1; i <= TOTAL_NFTS; i++) {
    try {
      const metadata = readAndCleanMetadata(i);
      tokenMetadata.push(metadata);
      if (i % 100 === 0 || i === 1 || i === TOTAL_NFTS) {
        console.log(`✓ Processed metadata for token ${i}`);
      }
    } catch (error) {
      console.error(`Error processing metadata for token ${i}:`, error);
    }
  }
  console.log(`✓ Processed ${tokenMetadata.length} tokens`);

  // Upload collection assets if you have them
  console.log("\n🖼️ Uploading collection assets...");
  let logoHash = "";
  let bannerHash = "";

  try {
    const logoPath = path.join(IMAGES_PATH, "logo.png");
    if (fs.existsSync(logoPath)) {
      logoHash = await uploadToPinataWithRetry(
        fs.readFileSync(logoPath),
        "logo.png",
        true
      );
      console.log(`✓ Uploaded logo.png -> ${logoHash}`);
    } else {
      console.log("⚠️ No logo.png found. Skipping...");
    }

    const bannerPath = path.join(IMAGES_PATH, "banner.png");
    if (fs.existsSync(bannerPath)) {
      bannerHash = await uploadToPinataWithRetry(
        fs.readFileSync(bannerPath),
        "banner.png",
        true
      );
      console.log(`✓ Uploaded banner.png -> ${bannerHash}`);
    } else {
      console.log("⚠️ No banner.png found. Skipping...");
    }
  } catch (error) {
    console.error("Error uploading collection assets:", error);
  }

  // Upload all token images and store their hashes
  console.log("\n🖼️ Uploading token images...");
  const imageHashes = new Map<string, string>();

  for (let i = 1; i <= TOTAL_NFTS; i++) {
    const fileName = `${i}.png`;
    if (!imageHashes.has(fileName)) {
      try {
        const imagePath = path.join(IMAGES_PATH, fileName);
        const hash = await uploadToPinataWithRetry(
          fs.readFileSync(imagePath),
          fileName,
          true
        );
        imageHashes.set(fileName, hash);
        if (i % 100 === 0 || i === 1 || i === TOTAL_NFTS) {
          console.log(`✓ Uploaded ${fileName} -> ${hash}`);
        }
      } catch (error) {
        console.error(`Error uploading image ${fileName}:`, error);
      }
    }
  }

  // Create the folder structure for Pinata
  const outputDir = path.join(
    process.env.HOME || "~",
    "Desktop/nft-collection/pinata-upload"
  );
  fs.mkdirSync(outputDir, { recursive: true });

  // Create collection metadata with IPFS paths
  const collectionMetadata = {
    name: "Pepe Rocks",
    description: "A bunch of rare rocks",
    image: logoHash ? `ipfs://${logoHash}` : "",
    banner_image_url: bannerHash ? `ipfs://${bannerHash}` : "",
  };

  // Save collection metadata
  fs.writeFileSync(
    path.join(outputDir, "collection"),
    JSON.stringify(collectionMetadata, null, 2)
  );

  // Create and save token metadata with IPFS paths
  console.log("\n📝 Creating token metadata...");
  for (let i = 0; i < tokenMetadata.length; i++) {
    const tokenId = i + 1;
    const fileName = `${tokenId}.png`;
    const hash = imageHashes.get(fileName);

    if (hash) {
      const finalMetadata = {
        ...tokenMetadata[i],
        image: `ipfs://${hash}`,
      };

      fs.writeFileSync(
        path.join(outputDir, `${tokenId}`), // Note: no .json extension as requested
        JSON.stringify(finalMetadata, null, 2)
      );

      if (tokenId % 100 === 0 || tokenId === 1 || tokenId === TOTAL_NFTS) {
        console.log(`✓ Created metadata file for token ${tokenId}`);
      }
    } else {
      console.error(`Missing hash for image ${fileName}`);
    }
  }

  console.log("\n✅ Folder structure created at:", outputDir);
  console.log("You can now upload this folder to Pinata manually.");
  console.log("\nAfter uploading, use these URIs in your contract:");
  console.log("baseURI: ipfs://<folder_hash>/");
  console.log("contractURI: ipfs://<folder_hash>/collection");
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
