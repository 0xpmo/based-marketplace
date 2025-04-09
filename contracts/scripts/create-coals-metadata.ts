// Helper script to create metadata for whales collection
// TO RUN:
// npx hardhat run scripts/create-whale-metadata.ts --network localhost
import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { parse } from "csv-parse/sync";

// You'll need to add these environment variables
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

// Add this as a configurable constant at the top of the file
const COLLECTION_PREFIX = "pepe-rocks-"; // Change this for each collection

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

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n👤 Creating collection with account:", deployer.address);

  // Parse metadata from CSV
  console.log("\n📑 Parsing metadata from CSV...");
  const metadataPath = path.join(__dirname, "./coals/final-coals-metadata.csv");
  const tokenMetadata = await parseMetadataCSV(metadataPath);
  console.log(`✓ Found ${tokenMetadata.length} tokens in CSV`);

  // First upload all images to get their CIDs
  console.log("\n🖼️ Uploading collection assets...");
  const logoHash = await uploadToPinataWithRetry(
    fs.readFileSync(path.join(__dirname, "./coals/assets/logo.png")),
    "logo.png",
    true
  );
  const bannerHash = await uploadToPinataWithRetry(
    fs.readFileSync(path.join(__dirname, "./coals/assets/banner.png")),
    "banner.png",
    true
  );

  // Upload all token images and store their hashes
  console.log("\n🖼️ Uploading token images...");
  const imageHashes = new Map<string, string>();
  for (const metadata of tokenMetadata) {
    const fileName = metadata.image.split("/").pop()!;
    if (!imageHashes.has(fileName)) {
      const imagePath = path.join(__dirname, "./coals/assets", fileName);
      const hash = await uploadToPinataWithRetry(
        fs.readFileSync(imagePath),
        fileName,
        true
      );
      imageHashes.set(fileName, hash);
      console.log(`✓ Uploaded ${fileName} -> ${hash}`);
    }
  }

  // Create the folder structure for Pinata
  const outputDir = path.join(__dirname, "./coals/pinata-upload");
  fs.mkdirSync(outputDir, { recursive: true });

  // Create collection metadata with IPFS paths
  const collectionMetadata = {
    name: "Pepe Rocks",
    description: "A bunch of rare rocks",
    image: `ipfs://${logoHash}`,
    banner_image_url: `ipfs://${bannerHash}`,
  };

  // Save collection metadata
  fs.writeFileSync(
    path.join(outputDir, "collection"),
    JSON.stringify(collectionMetadata, null, 2)
  );

  // Create and save token metadata with IPFS paths
  console.log("\n📝 Creating token metadata...");
  tokenMetadata.forEach((metadata, i) => {
    const fileName = metadata.image.split("/").pop()!;
    const hash = imageHashes.get(fileName)!;
    const tokenMetadata = {
      ...metadata,
      image: `ipfs://${hash}`,
    };
    fs.writeFileSync(
      path.join(outputDir, `${i + 1}`),
      JSON.stringify(tokenMetadata, null, 2)
    );
  });

  // Create unrevealed metadata JSON
  // const unrevealedMetadata = {
  //   name: "Mystery Based Whale",
  //   description:
  //     "This Based Whale is currently hidden. Collection will be revealed soon!",
  //   image: `ipfs://${logoHash}`, // Or upload a special placeholder image
  //   attributes: [],
  // };

  // // Save unrevealed metadata
  // fs.writeFileSync(
  //   path.join(outputDir, "unrevealed"),
  //   JSON.stringify(unrevealedMetadata, null, 2)
  // );

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

type MetadataOutput = {
  name: string;
  image: string;
  description?: string;
  external_url?: string;
  attributes: { trait_type: string; value: string }[];
};

async function parseMetadataCSV(csvPath: string): Promise<MetadataOutput[]> {
  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  // Sort by tokenID to ensure order
  const sortedRecords = records.sort(
    (a: any, b: any) => parseInt(a.tokenID) - parseInt(b.tokenID)
  );

  // Validate token IDs are sequential from 1
  let expectedTokenId = 1;
  const metadata = sortedRecords.map((row: any) => {
    const tokenId = parseInt(row.tokenID);

    if (tokenId !== expectedTokenId) {
      throw new Error(
        `Token IDs must be sequential. Expected ${expectedTokenId} but got ${tokenId}`
      );
    }
    expectedTokenId++;

    // Extract attributes (columns that start with 'attributes[')
    const attributes: { trait_type: string; value: string }[] = [];
    Object.entries(row).forEach(([key, value]) => {
      if (key.startsWith("attributes[") && value) {
        const traitType = key.replace("attributes[", "").replace("]", "");
        attributes.push({
          trait_type: traitType,
          value: value as string,
        });
      }
    });

    // Create metadata object
    const metadata: MetadataOutput = {
      name: row.name || `#${tokenId}`, // Use provided name or default to #tokenId
      image: `./whales/assets/${row.file_name}`, // Reference image in assets folder
      attributes: attributes,
    };

    // Add optional fields if they exist
    if (row.description) metadata.description = row.description;
    if (row.external_url) metadata.external_url = row.external_url;

    return metadata;
  });

  return metadata;
}
