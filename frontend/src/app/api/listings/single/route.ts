import { NextResponse } from "next/server";
import { getListing } from "@/lib/server/db";

export async function GET(request: Request) {
  // Get the listing details from the query string
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const tokenId = searchParams.get("tokenId");
  const seller = searchParams.get("seller");

  // Validate input
  if (!address || !tokenId || !seller) {
    return NextResponse.json(
      {
        error: "Collection address, token ID, and seller address are required",
      },
      { status: 400 }
    );
  }

  try {
    // Fetch the listing
    const listing = await getListing(address, tokenId, seller);

    // Return the listing
    return NextResponse.json({ listing });
  } catch (error) {
    console.error("Error fetching listing:", error);
    return NextResponse.json(
      { error: "Failed to fetch listing" },
      { status: 500 }
    );
  }
}
