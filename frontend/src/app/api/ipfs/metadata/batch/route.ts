import { NextRequest, NextResponse } from "next/server";

/**
 * Batch proxy for IPFS metadata to avoid CORS issues and reduce API calls
 * This endpoint fetches multiple metadata JSONs server-side and returns them in a single response
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const uris = body.uris;

    if (!uris || !Array.isArray(uris) || uris.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'uris' array parameter" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 100;
    if (uris.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }

    // List of IPFS gateways to try in order
    const gateways = [
      "https://gateway.pinata.cloud/ipfs/",
      "https://ipfs.io/ipfs/",
      "https://gateway.ipfs.io/ipfs/",
    ];

    // Process all URIs in parallel
    const metadataPromises = uris.map(async (uri: string) => {
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
          return {
            uri,
            error: "Could not extract CID from URI",
            metadata: null,
          };
        }
      } else {
        // For other HTTP URLs, try to fetch directly
        try {
          const response = await fetch(uri);
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }
          const data = await response.json();
          return { uri, metadata: data, error: null };
        } catch (error) {
          console.error(`Error fetching from direct URL: ${uri}`, error);
          return {
            uri,
            error: `Failed to fetch metadata: ${error}`,
            metadata: null,
          };
        }
      }

      let metadata = null;
      let lastError = null;

      // Try each gateway until we get a successful response
      for (const gateway of gateways) {
        try {
          const url = `${gateway}${cid}`;
          const res = await fetch(url, {
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
          console.error(
            `Failed to fetch metadata from gateway: ${gateway}`,
            err
          );
          // Continue to next gateway
        }
      }

      if (!metadata) {
        console.error(
          `All IPFS gateways failed to fetch metadata for ${uri}`,
          lastError
        );
        return {
          uri,
          error: "Failed to fetch metadata from all gateways",
          metadata: null,
        };
      }

      return { uri, metadata, error: null };
    });

    // Wait for all promises to resolve
    const results = await Promise.all(metadataPromises);

    // Create a map of URI to metadata
    const metadataMap = results.reduce((map, result) => {
      map[result.uri] = {
        metadata: result.metadata,
        error: result.error,
      };
      return map;
    }, {} as Record<string, { metadata: Record<string, unknown> | null; error: string | null }>);

    return NextResponse.json({
      success: true,
      results: metadataMap,
    });
  } catch (error) {
    console.error("Error processing batch metadata request:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Server error processing batch request",
      },
      { status: 500 }
    );
  }
}
