import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import CollectionABI from "@/contracts/BasedSeaSequentialNFTCollection.json";
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

    // Get total supply using ERC721Enumerable
    let totalSupply;
    try {
      totalSupply = await client.readContract({
        address: collection as `0x${string}`,
        abi: CollectionABI.abi,
        functionName: "totalSupply",
        args: [],
      });
    } catch (err) {
      console.error("Error getting totalSupply:", err);
      return NextResponse.json(
        { error: "Failed to get total supply" },
        { status: 500 }
      );
    }

    // Get all token IDs using ERC721Enumerable
    const tokenIds = [];
    const totalTokensCount = Number(totalSupply);

    for (let i = 0; i < totalTokensCount; i++) {
      try {
        // Use tokenByIndex from ERC721Enumerable
        const tokenId = await client.readContract({
          address: collection as `0x${string}`,
          abi: CollectionABI.abi,
          functionName: "tokenByIndex",
          args: [BigInt(i)],
        });

        // Add the token ID to our list
        tokenIds.push(Number(tokenId));
      } catch (err) {
        console.error(`Error getting token at index ${i}:`, err);
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
