import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import CollectionABI from "@/contracts/BasedNFTCollection.json";
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

    // Since tokenOfOwnerByIndex is not available, we need to check each token
    // First get the total minted
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

    // Check each token to see if the user owns it
    const userTokenIds = [];
    const totalTokens = Number(totalMinted);

    for (let tokenId = 1; tokenId <= totalTokens; tokenId++) {
      try {
        const tokenOwner = await client.readContract({
          address: collection as `0x${string}`,
          abi: CollectionABI.abi,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        });

        if (
          (tokenOwner as `0x${string}`).toLowerCase() === owner.toLowerCase()
        ) {
          userTokenIds.push(tokenId);
        }

        // If we've found all the tokens the user owns, we can stop checking
        if (userTokenIds.length >= tokenCount) {
          break;
        }
      } catch (err) {
        console.error(`Error checking ownership of token ${tokenId}:`, err);
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
