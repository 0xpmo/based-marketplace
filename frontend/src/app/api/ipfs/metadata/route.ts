import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for IPFS metadata to avoid CORS issues
 * This endpoint fetches metadata JSON server-side and returns it to the client
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uri = searchParams.get("uri");

  if (!uri) {
    return NextResponse.json(
      { error: "Missing URI parameter" },
      { status: 400 }
    );
  }

  let cid = "";

  // Parse the URI to extract CID
  if (uri.startsWith("ipfs://")) {
    cid = uri.substring(7);
  } else if (
    uri.match(/^[a-zA-Z0-9]{46}$/) ||
    uri.match(/^Qm[a-zA-Z0-9]{44}$/)
  ) {
    cid = uri;
  } else if (uri.startsWith("http") && uri.includes("/ipfs/")) {
    // Extract CID from http URL
    const cidMatch = uri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (cidMatch && cidMatch[1]) {
      cid = cidMatch[1];
    } else {
      return NextResponse.json(
        { error: "Could not extract CID from URI" },
        { status: 400 }
      );
    }
  } else {
    // For other HTTP URLs, try to fetch directly
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error(`Error fetching from direct URL: ${uri}`, error);
      return NextResponse.json(
        { error: `Failed to fetch metadata: ${error}` },
        { status: 502 }
      );
    }
  }

  // List of IPFS gateways to try in order
  const gateways = [
    "https://cloudflare-ipfs.com/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://gateway.ipfs.io/ipfs/",
  ];

  let metadata = null;
  let lastError = null;

  // Try each gateway until we get a successful response
  for (const gateway of gateways) {
    try {
      const url = `${gateway}${cid}`;
      const res = await fetch(url, {
        cache: "force-cache",
        headers: {
          Accept: "application/json",
        },
      });

      if (res.ok) {
        metadata = await res.json();
        break;
      }
    } catch (err) {
      lastError = err;
      console.error(`Failed to fetch metadata from gateway: ${gateway}`, err);
      // Continue to next gateway
    }
  }

  if (!metadata) {
    console.error("All IPFS gateways failed to fetch metadata", lastError);
    return NextResponse.json(
      { error: "Failed to fetch metadata from all gateways" },
      { status: 502 }
    );
  }

  return NextResponse.json(metadata);
}
