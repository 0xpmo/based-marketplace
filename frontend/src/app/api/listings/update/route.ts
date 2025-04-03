import { NextResponse } from "next/server";
import { updateListingQuantityAndPrice } from "@/lib/server/db";

export async function POST(request: Request) {
  try {
    // Parse the request body
    const { address, tokenId, seller, newQuantity, newPrice } =
      await request.json();

    // Validate the input
    if (!address || !tokenId || !seller || !newQuantity || !newPrice) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update the listing
    const success = await updateListingQuantityAndPrice(
      address,
      tokenId,
      seller,
      newQuantity,
      newPrice
    );

    // Return the result
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Failed to update listing" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error updating listing:", error);
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 }
    );
  }
}
