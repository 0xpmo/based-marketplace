import { NextResponse } from "next/server";
import { getActiveListingsForCollection } from "@/lib/server/db";

export async function GET(request: Request) {
  // Get the collection address from the query string
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  // Validate input
  if (!address) {
    return NextResponse.json(
      { error: "Collection address is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch the listings
    const listings = await getActiveListingsForCollection(address);

    // Return the listings
    return NextResponse.json({ listings });
  } catch (error) {
    console.error("Error fetching collection listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection listings" },
      { status: 500 }
    );
  }
}
