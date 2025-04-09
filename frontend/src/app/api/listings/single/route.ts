import { NextRequest, NextResponse } from "next/server";
import { getListing } from "@/lib/db-server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nftContract = searchParams.get("nftContract");
    const tokenIdParam = searchParams.get("tokenId");

    if (!nftContract || !tokenIdParam) {
      return NextResponse.json(
        { error: "nftContract and tokenId parameters are required" },
        { status: 400 }
      );
    }

    const tokenId = parseInt(tokenIdParam);

    // Get the listing from database
    const listing = await getListing(nftContract, tokenId);

    // Don't return 404 for missing listings, just return null
    // This allows the client to gracefully handle missing listings
    // and continue with blockchain queries
    return NextResponse.json(listing || null);
  } catch (error) {
    console.error("Error fetching listing:", error);

    // Return empty data instead of error to prevent stopping the client flow
    return NextResponse.json(null);
  }
}
