import { NextRequest, NextResponse } from "next/server";
import { getSellerListings } from "@/lib/db-server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seller = searchParams.get("seller");
    const status = parseInt(searchParams.get("status") || "1");

    if (!seller) {
      return NextResponse.json(
        { error: "seller parameter is required" },
        { status: 400 }
      );
    }

    // Get listings for the seller from database
    const listings = await getSellerListings(seller, status);

    return NextResponse.json(listings);
  } catch (error) {
    console.error("Error fetching seller listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch seller listings" },
      { status: 500 }
    );
  }
}
