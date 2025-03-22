// frontend/src/services/ipfs.ts
import axios from "axios";
import { CollectionMetadata } from "@/types/contracts";

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

/**
 * Converts an IPFS URI to a gateway URL or returns the original URL if not IPFS
 * @param uri IPFS URI or other URL
 * @returns Gateway URL or original URL if not IPFS
 */
export function getIPFSGatewayURL(uri: string): string {
  // If it's already using our proxy, return as is
  if (uri.startsWith("/api/ipfs/proxy")) {
    return uri;
  }

  // If it's an IPFS URI, convert to use our proxy
  if (uri.startsWith("ipfs://")) {
    const hash = uri.replace(/^ipfs:\/\//, "");
    return `/api/ipfs/proxy?hash=${encodeURIComponent(hash)}`;
  }

  // Return the original URI if not IPFS
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
 * Fetches metadata from IPFS using our proxy API
 * @param uri IPFS URI
 * @returns Metadata object or undefined if fetch fails
 */
export async function fetchFromIPFS(
  uri: string
): Promise<CollectionMetadata | undefined> {
  try {
    // Remove ipfs:// prefix if present
    const hash = uri.replace(/^ipfs:\/\//, "");

    // Use our proxy API route
    const response = await fetch(
      `/api/ipfs/proxy?hash=${encodeURIComponent(hash)}`
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: `HTTP error ${response.status}` }));
      console.error("Failed to fetch from IPFS proxy:", error);
      return undefined;
    }

    const data = (await response.json()) as {
      name: string;
      description: string;
      image: string;
      external_url?: string;
      attributes?: Array<{
        trait_type: string;
        value: string | number;
      }>;
    };

    // Validate required fields
    if (!data.name || !data.description || !data.image) {
      console.warn("Invalid metadata format:", data);
      return undefined;
    }

    // Convert image IPFS URI to use our proxy if it's an IPFS URI
    if (data.image.startsWith("ipfs://")) {
      const imageHash = data.image.replace(/^ipfs:\/\//, "");
      data.image = `/api/ipfs/proxy?hash=${encodeURIComponent(imageHash)}`;
    }

    // Return data in the format expected by CollectionMetadata
    return {
      name: data.name,
      description: data.description,
      image: data.image,
      external_url: data.external_url,
      attributes: data.attributes,
    };
  } catch (error) {
    console.error("Error fetching from IPFS:", error);
    return undefined;
  }
}
