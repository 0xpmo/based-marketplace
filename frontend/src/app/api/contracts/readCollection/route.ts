// frontend/src/app/api/contracts/readCollection/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import CollectionABI from "@/contracts/PepeNFTCollection.json";

// Get provider based on environment
const getProvider = () => {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545";
  return new ethers.JsonRpcProvider(rpcUrl);
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get("address");
    const property = searchParams.get("property");

    if (!address || !property) {
      return NextResponse.json(
        { error: "Missing address or property parameter" },
        { status: 400 }
      );
    }

    const provider = getProvider();
    const collection = new ethers.Contract(
      address,
      CollectionABI.abi,
      provider
    );

    // Call the specified property method
    const result = await collection[property]();

    return NextResponse.json({ result });
  } catch (error: unknown) {
    console.error("Error reading collection property:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
