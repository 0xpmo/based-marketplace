import { NextRequest, NextResponse } from "next/server";
import { updateListingStatus } from "@/lib/db-server";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { nftContract, tokenId, status, txHash, blockNumber } = body;

    // Validate required fields
    if (!nftContract || tokenId === undefined || status === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update the listing status in the database
    const listing = await updateListingStatus(
      nftContract,
      tokenId,
      status,
      txHash,
      blockNumber
    );

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found or not active" },
        { status: 404 }
      );
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error("Error updating listing status:", error);
    return NextResponse.json(
      { error: "Failed to update listing status" },
      { status: 500 }
    );
  }
}
