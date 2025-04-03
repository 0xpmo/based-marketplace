import { NextResponse } from "next/server";
import { getActiveListingsBySeller } from "@/lib/server/db";

export async function GET(request: Request) {
  // Get the seller address from the query string
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  // Validate input
  if (!address) {
    return NextResponse.json(
      { error: "Seller address is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch the listings
    const listings = await getActiveListingsBySeller(address);

    // Return the listings
    return NextResponse.json({ listings });
  } catch (error) {
    console.error("Error fetching seller listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch seller listings" },
      { status: 500 }
    );
  }
}
