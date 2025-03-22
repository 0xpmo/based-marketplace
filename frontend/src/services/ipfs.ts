// frontend/src/services/ipfs.ts
import axios from "axios";
import fs from "fs";

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

// Pinata API configuration
const pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const pinataSecretApiKey = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY;

const pinataEndpoint = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const pinataJSONEndpoint = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

// Using more reliable IPFS gateways
const IPFS_GATEWAY = "https://cloudflare-ipfs.com/ipfs/";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";
const BACKUP_GATEWAY = "https://ipfs.io/ipfs/";

/**
 * Converts an IPFS URI to a gateway URL
 * @param uri IPFS URI (ipfs://... or https://...)
 * @returns Gateway URL
 */
export function getIPFSGatewayURL(uri: string): string {
  if (!uri) return "/images/placeholder-nft.svg";

  // If already a HTTP URL, return as is
  if (uri.startsWith("http")) {
    return uri;
  }

  // If IPFS URI (ipfs://...), convert to gateway URL
  if (uri.startsWith("ipfs://")) {
    const cid = uri.substring(7);
    return `${IPFS_GATEWAY}${cid}`;
  }

  // If it's a CID directly, add the gateway
  if (uri.match(/^[a-zA-Z0-9]{46}$/) || uri.match(/^Qm[a-zA-Z0-9]{44}$/)) {
    return `${IPFS_GATEWAY}${uri}`;
  }

  // Try to handle potential relative paths or other edge cases
  if (uri.startsWith("/")) {
    // Likely a relative path on the server
    return uri;
  }

  // Return the original if we can't determine format
  console.log("Could not parse IPFS URI:", uri);
  return uri;
}

// Function to upload image to IPFS
export async function uploadImageToIPFS(file: File | Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axios.post<PinataResponse>(
      pinataEndpoint,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          pinata_api_key: pinataApiKey,
          pinata_secret_api_key: pinataSecretApiKey,
        },
      }
    );

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading image to IPFS:", error);
    throw new Error("Failed to upload image to IPFS");
  }
}

// Function to upload metadata to IPFS
export async function uploadMetadataToIPFS(
  metadata: NFTMetadata
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

/**
 * Fetches metadata from IPFS
 * @param uri IPFS URI or HTTP URL
 * @returns Parsed JSON data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchFromIPFS(uri: string): Promise<any> {
  const gatewayUrl = getIPFSGatewayURL(uri);

  try {
    const response = await fetch(gatewayUrl);

    if (!response.ok) {
      // Try alternate gateway if first one fails
      const alternateUrl = gatewayUrl.replace(IPFS_GATEWAY, PINATA_GATEWAY);
      const alternateResponse = await fetch(alternateUrl);

      if (!alternateResponse.ok) {
        // Try backup gateway as last resort
        const backupUrl = gatewayUrl.replace(IPFS_GATEWAY, BACKUP_GATEWAY);
        const backupResponse = await fetch(backupUrl);

        if (!backupResponse.ok) {
          throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
        }

        return await backupResponse.json();
      }

      return await alternateResponse.json();
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching from IPFS:", error);
    throw error;
  }
}

/**
 * Uploads file or JSON data to IPFS
 * @param data File path or JSON string
 * @returns IPFS URI
 */
export async function uploadToIPFS(data: string): Promise<string> {
  try {
    // Check if this is a file path or JSON string
    const isFilePath = data.startsWith("/") || data.includes("\\");

    if (isFilePath) {
      // Handle file upload
      const fileData = fs.readFileSync(data);
      const formData = new FormData();
      const blob = new Blob([fileData]);
      formData.append("file", blob);

      const response = await axios.post<PinataResponse>(
        pinataEndpoint,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            pinata_api_key: pinataApiKey,
            pinata_secret_api_key: pinataSecretApiKey,
          },
        }
      );

      return `ipfs://${response.data.IpfsHash}`;
    } else {
      // Handle JSON upload
      try {
        // Parse to validate it's JSON
        const metadata = JSON.parse(data);
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        throw new Error("Invalid JSON data");
      }
    }
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw new Error("Failed to upload to IPFS");
  }
}
