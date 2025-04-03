import { NextRequest, NextResponse } from "next/server";
import { getActiveListingsForToken } from "@/lib/db";
import { ethers } from "ethers";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get("collection");
    const tokenId = searchParams.get("tokenId");

    if (!collection || !tokenId) {
      return NextResponse.json(
        { error: "Collection address and tokenId are required" },
        { status: 400 }
      );
    }

    try {
      // Get listings from database instead of on-chain
      const listings = await getActiveListingsForToken(collection, tokenId);

      if (listings.length > 0) {
        // Get the lowest price listing for display
        // Sort by price for floor listings
        listings.sort((a, b) => {
          const priceA = ethers.getBigInt(a.price);
          const priceB = ethers.getBigInt(b.price);
          return priceA < priceB ? -1 : priceA > priceB ? 1 : 0;
        });

        const firstListing = listings[0];

        // Format the listing data
        const formattedListing = {
          price: ethers.formatEther(firstListing.price),
          seller: firstListing.seller,
          active: firstListing.status === "Active",
          quantity: firstListing.quantity,
          isERC1155: firstListing.isERC1155,
          allowedBuyer: firstListing.allowedBuyer,
          isPrivate: firstListing.isPrivate,
        };

        // Return listing details
        return NextResponse.json({
          listing: formattedListing,
          allListings: listings.map((l) => ({
            price: ethers.formatEther(l.price),
            seller: l.seller,
            active: l.status === "Active",
            quantity: l.quantity,
            isERC1155: l.isERC1155,
            allowedBuyer: l.allowedBuyer,
            isPrivate: l.isPrivate,
          })),
        });
      } else {
        // Return null if no listings found
        return NextResponse.json({ listing: null, allListings: [] });
      }
    } catch (dbError) {
      console.error("Error querying database:", dbError);
      // Return null for listing without error
      return NextResponse.json({ listing: null, allListings: [] });
    }
  } catch (error) {
    console.error("Error fetching token listing:", error);
    // Return null for listing without error status
    return NextResponse.json({ listing: null, allListings: [] });
  }
}
