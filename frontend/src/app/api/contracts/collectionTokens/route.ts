import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import CollectionABI from "@/contracts/BasedNFTCollection.json";
import { getActiveChain } from "@/config/chains";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get("collection");

    if (!collection) {
      return NextResponse.json(
        { error: "Missing collection parameter" },
        { status: 400 }
      );
    }

    // Create a public client to interact with the blockchain
    const client = createPublicClient({
      chain: getActiveChain(),
      transport: http(),
    });

    // Get total minted instead of supply
    let totalMinted;
    try {
      totalMinted = await client.readContract({
        address: collection as `0x${string}`,
        abi: CollectionABI.abi,
        functionName: "totalMinted",
        args: [],
      });
    } catch (err) {
      console.error("Error getting totalMinted:", err);
      return NextResponse.json(
        { error: "Failed to get total minted" },
        { status: 500 }
      );
    }

    // Get all token IDs - tokens start at ID 1
    const tokenIds = [];
    const totalTokens = Number(totalMinted);

    for (let tokenId = 1; tokenId <= totalTokens; tokenId++) {
      try {
        // Check if token exists by trying to get its owner
        await client.readContract({
          address: collection as `0x${string}`,
          abi: CollectionABI.abi,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        });

        // If we get here, the token exists
        tokenIds.push(tokenId);
      } catch (err) {
        console.error(`Error checking token ${tokenId}:`, err);
        // Continue to next token
      }
    }

    return NextResponse.json({ tokenIds });
  } catch (error) {
    console.error("Error in collection tokens route:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection tokens" },
      { status: 500 }
    );
  }
}
