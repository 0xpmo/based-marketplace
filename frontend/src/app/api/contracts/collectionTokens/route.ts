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

    // First, get the total supply of tokens
    let totalSupply;
    try {
      totalSupply = await client.readContract({
        address: collection as `0x${string}`,
        abi: CollectionABI.abi,
        functionName: "totalSupply",
      });
    } catch (err) {
      console.error(
        `Error calling totalSupply on collection ${collection}:`,
        err
      );
      return NextResponse.json({ tokenIds: [] });
    }

    // Convert BigInt to number
    const supply = Number(totalSupply);

    // If there are no tokens, return an empty array
    if (supply === 0) {
      return NextResponse.json({ tokenIds: [] });
    }

    // Get all token IDs using tokenByIndex
    const tokenIds = [];
    for (let i = 0; i < supply; i++) {
      try {
        const tokenId = await client.readContract({
          address: collection as `0x${string}`,
          abi: CollectionABI.abi,
          functionName: "tokenByIndex",
          args: [BigInt(i)],
        });

        tokenIds.push(Number(tokenId));
      } catch (err) {
        console.error(`Error getting token at index ${i}:`, err);
        // Continue to next index
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
