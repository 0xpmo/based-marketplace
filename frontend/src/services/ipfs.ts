// frontend/src/services/ipfs.ts
import axios from "axios";

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

// Function to upload image to IPFS
export async function uploadImageToIPFS(file: File): Promise<string> {
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

// Function to get IPFS URL for gateway access
export function getIPFSGatewayURL(ipfsURI: string): string {
  if (!ipfsURI) return "";

  // Replace ipfs:// with the gateway URL
  if (ipfsURI.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${ipfsURI.slice(7)}`;
  }

  return ipfsURI;
}

// Function to fetch metadata from IPFS
export async function fetchFromIPFS<T>(ipfsURI: string): Promise<T> {
  try {
    const gatewayURL = getIPFSGatewayURL(ipfsURI);
    const response = await axios.get<T>(gatewayURL);
    return response.data;
  } catch (error) {
    console.error("Error fetching from IPFS:", error);
    throw new Error("Failed to fetch from IPFS");
  }
}
