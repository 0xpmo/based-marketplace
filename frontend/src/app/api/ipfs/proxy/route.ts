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
        responseType: "arraybuffer", // Handle any content type
        headers: {
          Accept: "*/*", // Accept any content type
        },
      });

      // Get content type from response
      const contentType = response.headers["content-type"];

      // Return the appropriate response based on content type
      if (contentType?.includes("application/json")) {
        // If it's JSON, parse and return as JSON
        const jsonData = JSON.parse(
          Buffer.from(response.data as Buffer).toString()
        );
        return NextResponse.json(jsonData);
      } else {
        // For non-JSON (images, etc), return as binary with correct content type
        return new NextResponse(Buffer.from(response.data as Buffer), {
          headers: {
            "Content-Type": contentType || "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
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
