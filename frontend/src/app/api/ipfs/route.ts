import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for IPFS content to avoid CORS issues
 * This endpoint fetches IPFS content server-side and returns it to the client
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cid = searchParams.get("cid");

  if (!cid) {
    return NextResponse.json(
      { error: "Missing CID parameter" },
      { status: 400 }
    );
  }

  // List of IPFS gateways to try in order
  const gateways = [
    "https://cloudflare-ipfs.com/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://gateway.ipfs.io/ipfs/",
  ];

  let response = null;
  let error = null;

  // Try each gateway until we get a successful response
  for (const gateway of gateways) {
    try {
      const url = `${gateway}${cid}`;
      const res = await fetch(url, { cache: "force-cache" });

      if (res.ok) {
        response = res;
        break;
      }
    } catch (err) {
      error = err;
      console.error(`Failed to fetch from gateway: ${gateway}`, err);
      // Continue to next gateway
    }
  }

  if (!response) {
    console.error("All IPFS gateways failed", error);
    return NextResponse.json(
      { error: "Failed to fetch IPFS content from all gateways" },
      { status: 502 }
    );
  }

  // Get the content type to properly set in the response
  const contentType =
    response.headers.get("content-type") || "application/octet-stream";

  // Return the response with appropriate content type
  const data = await response.arrayBuffer();

  return new NextResponse(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
