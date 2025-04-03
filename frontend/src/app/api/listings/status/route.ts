import { NextResponse } from "next/server";
import { updateListingStatus } from "@/lib/server/db";

interface UpdateStatusRequest {
  nftContract: string;
  tokenId: string;
  seller: string;
  status: "Active" | "Sold" | "Canceled";
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const { nftContract, tokenId, seller, status } =
      (await request.json()) as UpdateStatusRequest;

    // Validate the input
    if (!nftContract || !tokenId || !seller || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate the status
    if (status !== "Active" && status !== "Sold" && status !== "Canceled") {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // Update the listing status
    const success = await updateListingStatus(
      nftContract,
      tokenId,
      seller,
      status
    );

    // Return the result
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Failed to update listing status" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error updating listing status:", error);
    return NextResponse.json(
      { error: "Failed to update listing status" },
      { status: 500 }
    );
  }
}
