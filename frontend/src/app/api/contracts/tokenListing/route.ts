import { NextRequest, NextResponse } from "next/server";
import { getMarketplaceContractReadOnly } from "@/lib/contracts";
import { ethers } from "ethers";
// import { ListingStatus } from "@/contracts/IBasedSeaMarketplaceStorage.json";

const ListingStatus = {
  Inactive: 0,
  Active: 1,
  Sold: 2,
  Canceled: 3,
};

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
      // Get marketplace contract
      const marketplaceContract = await getMarketplaceContractReadOnly();

      // Get listing
      const listing = await marketplaceContract.getListing(collection, tokenId);

      // Format the listing data
      const formattedListing = {
        price: ethers.formatEther(listing.price),
        seller: listing.seller,
        active: Number(listing.status) === ListingStatus.Active,
      };

      // Return listing details
      return NextResponse.json({
        listing: Number(listing.status) ? formattedListing : null,
      });
    } catch (contractError) {
      console.log(
        "Contract may not exist or have different interface:",
        contractError
      );
      // Return null for listing without error
      return NextResponse.json({ listing: null });
    }
  } catch (error) {
    console.error("Error fetching token listing:", error);
    // Return null for listing without error status
    return NextResponse.json({ listing: null });
  }
}
