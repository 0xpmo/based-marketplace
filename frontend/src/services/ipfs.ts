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

// These are no longer used since we're using our server-side proxy
// const IPFS_GATEWAY = "https://cloudflare-ipfs.com/ipfs/";
// const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";
// const BACKUP_GATEWAY = "https://ipfs.io/ipfs/";

/**
 * Converts an IPFS URI to a gateway URL
 * @param uri IPFS URI (ipfs://... or https://...)
 * @returns Gateway URL
 */
export function getIPFSGatewayURL(uri: string): string {
  if (!uri) return "/images/placeholder-nft.svg";

  // If already a HTTP URL, return as is (except if it's an IPFS gateway that might have CORS issues)
  if (uri.startsWith("http")) {
    // Check if this is already an IPFS gateway URL that might have CORS issues
    const ipfsGatewayPatterns = [
      "ipfs.io/ipfs/",
      "cloudflare-ipfs.com/ipfs/",
      "gateway.pinata.cloud/ipfs/",
      "gateway.ipfs.io/ipfs/",
    ];

    // If it's not an IPFS gateway URL, return as is
    if (!ipfsGatewayPatterns.some((pattern) => uri.includes(pattern))) {
      return uri;
    }

    // Otherwise, extract the CID and use our proxy
    for (const pattern of ipfsGatewayPatterns) {
      const index = uri.indexOf(pattern);
      if (index !== -1) {
        // Extract the CID after the pattern
        const cid = uri.substring(index + pattern.length);
        return `/api/ipfs?cid=${encodeURIComponent(cid)}`;
      }
    }

    // If we couldn't extract a CID but it's a gateway URL, return as is
    return uri;
  }

  // Extract CID from IPFS URI
  let cid = "";

  // If IPFS URI (ipfs://...), extract the CID
  if (uri.startsWith("ipfs://")) {
    cid = uri.substring(7);
    return `/api/ipfs?cid=${encodeURIComponent(cid)}`;
  }

  // If it's a CID directly, add the gateway
  if (uri.match(/^[a-zA-Z0-9]{46}$/) || uri.match(/^Qm[a-zA-Z0-9]{44}$/)) {
    cid = uri;
    return `/api/ipfs?cid=${encodeURIComponent(cid)}`;
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
export async function fetchFromIPFS(
  uri: string
): Promise<Record<string, unknown>> {
  try {
    // Use our server-side proxy to avoid CORS issues
    const proxyUrl = `/api/ipfs/metadata?uri=${encodeURIComponent(uri)}`;

    try {
      const response = await fetch(proxyUrl);
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Proxy error: ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching from metadata proxy:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error fetching from IPFS:", error);
    throw error;
  }
}

/**
 * Uploads file or JSON data to IPFS
 * @param data File object or JSON string
 * @returns IPFS URI
 */
export async function uploadToIPFS(data: string | File): Promise<string> {
  try {
    // Check if this is a File object or JSON string
    const isFile = typeof File !== "undefined" && data instanceof File;

    if (isFile) {
      // Handle file upload
      const formData = new FormData();
      formData.append("file", data as File);

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
    } else if (typeof data === "string" && data.startsWith("/")) {
      // Handle file path (from server-side)
      const fs = await import("fs/promises");
      const formData = new FormData();
      const fileBuffer = await fs.readFile(data);
      const blob = new Blob([fileBuffer]);
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
        const metadata = JSON.parse(data as string);
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
