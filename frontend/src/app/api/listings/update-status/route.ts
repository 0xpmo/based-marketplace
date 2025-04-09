import { NextRequest, NextResponse } from "next/server";
import { updateListingStatus } from "@/lib/db-server";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { nftContract, tokenId, status, txHash, blockNumber } = body;

    console.log(`API: Updating listing status: ${JSON.stringify(body)}`);

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
      console.warn(
        `API: No listing found or update failed for contract ${nftContract}, token ${tokenId}`
      );
      return NextResponse.json(
        { error: "Listing not found or update failed", success: false },
        { status: 404 }
      );
    }

    console.log(
      `API: Successfully updated listing status to ${status} for token ${tokenId}`
    );
    return NextResponse.json({ ...listing, success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error updating listing status:", errorMessage);
    return NextResponse.json(
      {
        error: `Failed to update listing status: ${errorMessage}`,
        success: false,
      },
      { status: 500 }
    );
  }
}
