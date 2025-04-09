import { NextRequest, NextResponse } from "next/server";
import { createListing } from "@/lib/db-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      seller,
      nftContract,
      tokenId,
      price,
      priceWei,
      isPrivate,
      allowedBuyer,
      txHash,
      blockNumber,
    } = body;

    // Validate required fields
    if (
      !seller ||
      !nftContract ||
      tokenId === undefined ||
      !price ||
      !priceWei
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create the listing in the database
    const listing = await createListing(
      seller,
      nftContract,
      tokenId,
      price,
      priceWei,
      isPrivate,
      allowedBuyer,
      txHash,
      blockNumber
    );

    return NextResponse.json(listing);
  } catch (error) {
    console.error("Error creating listing:", error);
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    );
  }
}
