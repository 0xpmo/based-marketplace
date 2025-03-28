import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import CollectionABI from "@/contracts/BasedSeaSequentialNFTCollection.json";
import { getActiveChain } from "@/config/chains";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get("collection");
    const owner = searchParams.get("owner");

    if (!collection || !owner) {
      return NextResponse.json(
        { error: "Missing collection or owner parameter" },
        { status: 400 }
      );
    }

    // Create a public client to interact with the blockchain
    const client = createPublicClient({
      chain: getActiveChain(),
      transport: http(),
    });

    // First, get the balance of tokens owned by the user
    let balance;
    try {
      balance = await client.readContract({
        address: collection as `0x${string}`,
        abi: CollectionABI.abi,
        functionName: "balanceOf",
        args: [owner as `0x${string}`],
      });
      console.log("Balance:", balance);
    } catch (err) {
      console.error(`Error calling balanceOf for owner ${owner}:`, err);
      return NextResponse.json({ tokenIds: [] });
    }

    // Convert BigInt to number
    const tokenCount = Number(balance);

    // If user has no tokens, return an empty array
    if (tokenCount === 0) {
      return NextResponse.json({ tokenIds: [] });
    }

    // Use ERC721Enumerable's tokenOfOwnerByIndex function to get all tokens
    const userTokenIds = [];

    for (let i = 0; i < tokenCount; i++) {
      try {
        const tokenId = await client.readContract({
          address: collection as `0x${string}`,
          abi: CollectionABI.abi,
          functionName: "tokenOfOwnerByIndex",
          args: [owner as `0x${string}`, BigInt(i)],
        });

        userTokenIds.push(Number(tokenId));
      } catch (err) {
        console.error(`Error getting token at owner index ${i}:`, err);
        // Continue to next token
      }
    }

    return NextResponse.json({ tokenIds: userTokenIds });
  } catch (error) {
    console.error("Error in userTokens route:", error);
    return NextResponse.json(
      { error: "Failed to fetch user tokens" },
      { status: 500 }
    );
  }
}
