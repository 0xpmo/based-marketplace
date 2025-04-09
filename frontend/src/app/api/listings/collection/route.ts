import { NextRequest, NextResponse } from "next/server";
import { getCollectionListings } from "@/lib/db-server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nftContract = searchParams.get("nftContract");
    const status = parseInt(searchParams.get("status") || "1");
    const page = parseInt(searchParams.get("page") || "0");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    if (!nftContract) {
      return NextResponse.json(
        { error: "nftContract parameter is required" },
        { status: 400 }
      );
    }

    // Get listings for the collection from database
    const result = await getCollectionListings(
      nftContract,
      status,
      page,
      pageSize
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching collection listings:", error);

    // Return empty listings instead of an error
    // This allows the client to gracefully handle database errors
    // and continue with blockchain queries
    return NextResponse.json({ listings: [], total: 0 });
  }
}
