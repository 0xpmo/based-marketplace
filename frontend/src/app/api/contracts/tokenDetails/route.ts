import { NextRequest, NextResponse } from "next/server";
import { getNFTContractByAddress } from "@/lib/contracts";

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
      // Get contract
      const contract = await getNFTContractByAddress(collection);

      try {
        // Get token details - wrapped in try/catch to handle non-existent tokens
        const owner = await contract.ownerOf(tokenId);
        const tokenURI = await contract.tokenURI(tokenId);

        // Return token details
        return NextResponse.json({
          tokenId,
          owner,
          tokenURI,
        });
      } catch (tokenError) {
        console.error("Error fetching token data:", tokenError);
        return NextResponse.json({
          tokenId,
          owner: "0x0000000000000000000000000000000000000000", // Default placeholder owner
          tokenURI: null,
          error: "Token may not exist",
        });
      }
    } catch (contractError) {
      console.error("Error with NFT contract:", contractError);

      // Return default data for demo purposes
      return NextResponse.json({
        tokenId,
        owner: "0x0000000000000000000000000000000000000000", // Default placeholder owner
        tokenURI: null,
        error: "Contract may not exist or have different interface",
      });
    }
  } catch (error) {
    console.error("Error fetching token details:", error);
    return NextResponse.json(
      { error: "Failed to fetch token details" },
      { status: 500 }
    );
  }
}
