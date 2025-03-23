import { NextRequest, NextResponse } from "next/server";
import { uploadToIPFS } from "@/services/ipfs";

export async function POST(request: NextRequest) {
  try {
    // Parse the JSON body
    const body = await request.json();

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON data" }, { status: 400 });
    }

    // Upload JSON to IPFS
    const metadataUri = await uploadToIPFS(JSON.stringify(body));

    return NextResponse.json({ uri: metadataUri });
  } catch (error) {
    console.error("Error in IPFS JSON upload route:", error);
    return NextResponse.json(
      { error: "Failed to upload JSON to IPFS" },
      { status: 500 }
    );
  }
}
