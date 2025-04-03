import { NextResponse } from "next/server";
import { createListing } from "@/lib/server/db";
import { Listing } from "@/types/listings";

export async function POST(request: Request) {
  try {
    // Parse the request body
    const listing = (await request.json()) as Listing;

    // Validate the listing data
    if (
      !listing.nftContract ||
      !listing.tokenId ||
      !listing.seller ||
      !listing.price
    ) {
      return NextResponse.json(
        { error: "Missing required listing fields" },
        { status: 400 }
      );
    }

    // Create the listing
    const success = await createListing(listing);

    // Return the result
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Failed to create listing" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error creating listing:", error);
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    );
  }
}
