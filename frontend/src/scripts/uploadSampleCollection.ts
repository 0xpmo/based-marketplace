// import { uploadImageToIPFS, uploadMetadataToIPFS } from "../services/ipfs.js";
// import fs from "node:fs";
// import path from "node:path";
// import { fileURLToPath } from "node:url";

// // Get __dirname equivalent in ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
import axios from "axios";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";
import FormData from "form-data";
// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Log to verify
console.log(
  "Pinata API Key available:",
  !!process.env.NEXT_PUBLIC_PINATA_API_KEY
);
console.log(
  "Pinata Secret Key available:",
  !!process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY
);
// Define the response type for Pinata
interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

// Pinata API configuration
const pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const pinataSecretApiKey = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY;

const pinataEndpoint = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const pinataJSONEndpoint = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

// Function to upload file to IPFS using Node.js FormData
async function uploadFileToIPFS(filePath: string): Promise<string> {
  try {
    console.log(`Uploading file from: ${filePath}`);

    // Create a form data instance
    const formData = new FormData();

    // Append the file to the form data
    formData.append("file", fs.createReadStream(filePath), {
      filename: path.basename(filePath),
    });

    const response = await axios.post<PinataResponse>(
      pinataEndpoint,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: pinataApiKey,
          pinata_secret_api_key: pinataSecretApiKey,
        },
        maxBodyLength: Infinity,
      }
    );

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading file to IPFS:", error);
    throw new Error("Failed to upload file to IPFS");
  }
}

// Function to upload metadata to IPFS
async function uploadJSONToIPFS(
  metadata: Record<string, unknown>
): Promise<string> {
  try {
    const response = await axios.post<PinataResponse>(
      pinataJSONEndpoint,
      metadata,
      {
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: pinataApiKey,
          pinata_secret_api_key: pinataSecretApiKey,
        },
      }
    );

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading metadata to IPFS:", error);
    throw new Error("Failed to upload metadata to IPFS");
  }
}

async function main() {
  try {
    // Get fee recipient from environment variable or use a default address
    const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS;

    if (!feeRecipient) {
      console.warn(
        "Warning: NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS not set in .env.local"
      );
      console.warn(
        "Please set this to your wallet address to receive royalties"
      );
    }

    // First, upload the collection image to IPFS
    console.log("Uploading collection image to IPFS...");

    // Check for multiple path possibilities
    const possiblePaths = [
      path.join(__dirname, "../assets/collection-image.jpeg"),
      path.join(__dirname, "../../src/assets/collection-image.jpeg"),
      path.join(
        __dirname,
        "../../../frontend/src/assets/collection-image.jpeg"
      ),
      path.join(process.cwd(), "src/assets/collection-image.jpeg"),
    ];

    console.log("Looking for image in these locations:");
    possiblePaths.forEach((p) => console.log(` - ${p}`));

    let imageFilePath = "";
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        imageFilePath = p;
        console.log(`Found image at: ${imageFilePath}`);
        break;
      }
    }

    if (!imageFilePath) {
      console.error("Image file not found in any of the expected locations.");
      console.error(
        "Please place your collection image at src/assets/collection-image.jpg"
      );
      process.exit(1);
    }

    // Upload the image to IPFS
    const imageUri = await uploadFileToIPFS(imageFilePath);
    console.log("Image uploaded to IPFS:", imageUri);

    // Sample collection metadata with the real image URI
    // const collectionMetadata = {
    //   name: "Coals Originals",
    //   description: "A collection of unique coals on the Based AI chain",
    //   image: imageUri, // Use the IPFS URI of our uploaded image
    //   external_link: "",
    //   seller_fee_basis_points: 500, // 5% royalty
    //   fee_recipient:
    //     feeRecipient || "0x0000000000000000000000000000000000000000", // Use environment variable or zero address
    // };

    const collectionMetadata = {
      name: "Coal Originals",
      description: "A collection of unique coals on the Based AI chain",
      image: "ipfs://QmQ4Uo5UkJEYLBTJk8tjrn29e6T9Cc1W3qZpcK1amt4xyi",
      external_link: "",
      seller_fee_basis_points: 500,
      fee_recipient: feeRecipient,
    };

    // Upload metadata to IPFS
    console.log("Uploading collection metadata to IPFS...");
    const ipfsUri = await uploadJSONToIPFS(collectionMetadata);
    console.log("Collection metadata uploaded to IPFS:", ipfsUri);
    console.log("You can now use this URI in your contract deployment");
  } catch (error) {
    console.error("Error uploading collection:", error);
  }
}

main();
