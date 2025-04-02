// Script to generate metadata for KekTrumps ERC1155 collection
// TO RUN:
// npx hardhat run scripts/create-kektrumps-metadata.ts --network localhost
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { parse } from "csv-parse/sync";

// You'll need to add these environment variables
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

// Add this as a configurable constant at the top of the file
const COLLECTION_PREFIX = "kektrumps-"; // Change this for each collection

// Rarity names (must match contract)
const RARITIES = ["Bronze", "Silver", "Gold", "Green"];

type MetadataRecord = {
  character_id: number;
  name: string;
  rarity_id: number;
  rarity_name: string;
  external_url: string;
};

type MetadataOutput = {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: { trait_type: string; value: string }[];
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n👤 Creating collection with account:", deployer.address);

  // Parse metadata from CSV
  console.log("\n📑 Parsing metadata from CSV...");
  const metadataPath = path.join(
    __dirname,
    "./kektrumps/kektrumps-metadata.csv"
  );
  const metadataRecords = await parseMetadataCSV(metadataPath);
  console.log(`✓ Found ${metadataRecords.length} records in CSV`);

  // Upload collection assets
  console.log("\n🖼️ Uploading collection assets...");
  const logoHash = await uploadToPinataWithRetry(
    fs.readFileSync(
      path.join(__dirname, "./kektrumps/assets/kektrumps-logo.png")
    ),
    "logo.png",
    true
  );
  const bannerHash = await uploadToPinataWithRetry(
    fs.readFileSync(
      path.join(__dirname, "./kektrumps/assets/kektrumps-banner.jpg")
    ),
    "banner.jpg",
    true
  );

  // Create output directories
  const outputDir = path.join(__dirname, "./kektrumps/pinata-upload");
  fs.mkdirSync(outputDir, { recursive: true });

  // Create collection metadata
  const collectionMetadata = {
    name: "KekTrumps",
    description: "Rare Keks",
    image: `ipfs://${logoHash}`,
    banner_image_url: `ipfs://${bannerHash}`,
    external_link: "https://quantumkek.ai",
  };

  // Save collection metadata
  fs.writeFileSync(
    path.join(outputDir, "collection"),
    JSON.stringify(collectionMetadata, null, 2)
  );

  // Upload images and create metadata
  console.log("\n🖼️ Processing characters and rarities...");

  // Track all image hashes to avoid duplicate uploads
  const imageHashes = new Map<string, string>();

  // Group records by character_id
  const characterMap = new Map<number, MetadataRecord[]>();
  for (const record of metadataRecords) {
    if (!characterMap.has(record.character_id)) {
      characterMap.set(record.character_id, []);
    }
    characterMap.get(record.character_id)!.push(record);
  }

  // For each character
  for (const [characterId, records] of characterMap.entries()) {
    // Create character directory
    const characterDir = path.join(outputDir, characterId.toString());
    fs.mkdirSync(characterDir, { recursive: true });

    // Process each rarity for this character
    for (const record of records) {
      // Image filename follows the pattern characterId_rarityId.png
      const imageFilename = `${record.character_id}_${record.rarity_id}.png`;
      const imagePath = path.join(
        __dirname,
        "./kektrumps/assets",
        imageFilename
      );

      // Upload image if it exists
      let imageHash;
      if (fs.existsSync(imagePath)) {
        if (imageHashes.has(imageFilename)) {
          imageHash = imageHashes.get(imageFilename);
        } else {
          imageHash = await uploadToPinataWithRetry(
            fs.readFileSync(imagePath),
            imageFilename,
            true
          );
          imageHashes.set(imageFilename, imageHash);
        }
        console.log(`✓ Uploaded ${imageFilename} -> ${imageHash}`);
      } else {
        console.warn(`⚠️ Image not found: ${imagePath} - Using placeholder`);
        // Use logo as fallback if character image doesn't exist
        imageHash = logoHash;
      }

      // Create metadata for this character/rarity combo
      const metadata: MetadataOutput = {
        name: record.name, // Just the character name without rarity
        description: "", // Empty description to be filled in later
        image: `ipfs://${imageHash}`,
        external_url: record.external_url,
        attributes: [
          {
            trait_type: "Character",
            value: record.name,
          },
          {
            trait_type: "Rarity",
            value: record.rarity_name,
          },
        ],
      };

      // Save metadata file - the contract expects the filename to be the rarityId
      fs.writeFileSync(
        path.join(characterDir, `${record.rarity_id}.json`),
        JSON.stringify(metadata, null, 2)
      );

      console.log(
        `✓ Created metadata for ${record.name} - ${record.rarity_name}`
      );
    }
  }

  console.log("\n✅ Metadata structure created at:", outputDir);
  console.log(
    "You can now upload this folder to Pinata manually or use the uploadDirectory function."
  );
  console.log("\nAfter uploading, use these URIs in your contract:");
  console.log("baseURI: ipfs://<folder_hash>/");
  console.log("contractURI: ipfs://<folder_hash>/collection");

  // Uncomment this to upload the entire directory to IPFS
  /*
  console.log("\n📤 Uploading entire metadata directory to IPFS...");
  const directoryHash = await uploadDirectoryToPinata(outputDir);
  console.log(`✅ Directory uploaded successfully!`);
  console.log(`baseURI: ipfs://${directoryHash}/`);
  console.log(`contractURI: ipfs://${directoryHash}/collection`);
  */
}

async function parseMetadataCSV(csvPath: string): Promise<MetadataRecord[]> {
  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  return records.map((row: any) => ({
    character_id: parseInt(row.character_id),
    name: row.name,
    rarity_id: parseInt(row.rarity_id),
    rarity_name: row.rarity_name,
    external_url: row.external_url,
  }));
}

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

async function uploadDirectoryToPinata(dirPath: string): Promise<string> {
  try {
    // Use pinata-sdk for directory uploads
    // This is a simplified version - you may want to use pinata-sdk for better directory handling
    const formData = new FormData();

    // Add all files in the directory recursively
    function addFilesFromDirectory(directory: string, basePath: string = "") {
      const files = fs.readdirSync(directory);
      for (const file of files) {
        const filePath = path.join(directory, file);
        const relativePath = path.join(basePath, file);

        if (fs.statSync(filePath).isDirectory()) {
          addFilesFromDirectory(filePath, relativePath);
        } else {
          formData.append("file", fs.createReadStream(filePath), {
            filepath: relativePath,
          });
        }
      }
    }

    addFilesFromDirectory(dirPath);

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

    return response.data.IpfsHash;
  } catch (error) {
    console.error("Error uploading directory to Pinata:", error);
    throw error;
  }
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
