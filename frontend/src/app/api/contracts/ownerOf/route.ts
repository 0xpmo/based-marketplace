import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import CollectionABI from "@/contracts/BasedSeaSequentialNFTCollection.json";
import { getActiveChain } from "@/config/chains";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get("collection");
    const tokenId = searchParams.get("tokenId");

    if (!collection || !tokenId) {
      return NextResponse.json(
        { error: "Missing collection or tokenId parameter" },
        { status: 400 }
      );
    }

    // Create a public client to interact with the blockchain
    const client = createPublicClient({
      chain: getActiveChain(),
      transport: http(),
    });

    // Call the ownerOf function of the collection contract
    const owner = await client.readContract({
      address: collection as `0x${string}`,
      abi: CollectionABI.abi,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });

    return NextResponse.json({ owner });
  } catch (error) {
    console.error("Error in ownerOf route:", error);
    return NextResponse.json(
      { error: "Failed to fetch owner" },
      { status: 500 }
    );
  }
}
