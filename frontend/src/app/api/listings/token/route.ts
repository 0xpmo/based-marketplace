import { NextResponse } from "next/server";
import { getActiveListingsForToken } from "@/lib/server/db";

export async function GET(request: Request) {
  // Get the token details from the query string
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const tokenId = searchParams.get("tokenId");

  // Validate input
  if (!address || !tokenId) {
    return NextResponse.json(
      { error: "Collection address and token ID are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch the listings
    const listings = await getActiveListingsForToken(address, tokenId);

    // Return the listings
    return NextResponse.json({ listings });
  } catch (error) {
    console.error("Error fetching token listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch token listings" },
      { status: 500 }
    );
  }
}
