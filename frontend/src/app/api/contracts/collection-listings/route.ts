import { NextRequest, NextResponse } from "next/server";
import { getActiveListingsForCollection } from "@/lib/server/db";
import { ethers } from "ethers";

interface ListingData {
  price: string;
  seller: string;
  active: boolean;
  quantity: number;
  isERC1155: boolean;
  allowedBuyer: string | null;
  isPrivate: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get("collection");

    if (!collection) {
      return NextResponse.json(
        { error: "Collection address is required" },
        { status: 400 }
      );
    }

    // Get listings from database
    const listings = await getActiveListingsForCollection(collection);

    // Group listings by tokenId for easy access
    const listingsByTokenId: Record<string, ListingData[]> = {};

    listings.forEach((listing) => {
      if (!listingsByTokenId[listing.tokenId]) {
        listingsByTokenId[listing.tokenId] = [];
      }

      listingsByTokenId[listing.tokenId].push({
        price: ethers.formatEther(listing.price),
        seller: listing.seller,
        active: listing.status === "Active",
        quantity: listing.quantity,
        isERC1155: listing.isERC1155,
        allowedBuyer: listing.allowedBuyer,
        isPrivate: listing.isPrivate,
      });
    });

    // For each tokenId, find the lowest price listing
    const floorListings: Record<string, ListingData> = {};

    Object.keys(listingsByTokenId).forEach((tokenId) => {
      const tokenListings = listingsByTokenId[tokenId];

      // Sort by price (lowest first)
      tokenListings.sort((a, b) => {
        const priceA = parseFloat(a.price);
        const priceB = parseFloat(b.price);
        return priceA - priceB;
      });

      // Get the lowest price listing
      floorListings[tokenId] = tokenListings[0];
    });

    return NextResponse.json({
      listings: floorListings,
      allListings: listings.map((l) => ({
        tokenId: l.tokenId,
        price: ethers.formatEther(l.price),
        seller: l.seller,
        active: l.status === "Active",
        quantity: l.quantity,
        isERC1155: l.isERC1155,
        allowedBuyer: l.allowedBuyer,
        isPrivate: l.isPrivate,
      })),
    });
  } catch (error) {
    console.error("Error fetching collection listings:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch listings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
