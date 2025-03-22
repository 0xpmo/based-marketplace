import { NextResponse } from "next/server";
import axios from "axios";

// List of public IPFS gateways to try
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (!hash) {
    return NextResponse.json(
      { error: "IPFS hash is required" },
      { status: 400 }
    );
  }

  // Remove ipfs:// prefix if present
  const cleanHash = hash.replace(/^ipfs:\/\//, "");

  // Try each gateway in sequence
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = `${gateway}${cleanHash}`;
      console.log(`Trying IPFS gateway: ${url}`);

      const response = await axios.get(url, {
        headers: {
          Accept: "application/json",
        },
      });

      // If we get here, the request was successful
      return NextResponse.json(response.data);
    } catch (error) {
      console.warn(`Failed to fetch from gateway ${gateway}:`, error);
      continue;
    }
  }

  // If all gateways fail, return an error
  return NextResponse.json(
    { error: "Failed to fetch from all IPFS gateways" },
    { status: 502 }
  );
}
