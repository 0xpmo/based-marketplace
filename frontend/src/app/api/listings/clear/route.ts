import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nftContract = searchParams.get("nftContract");
    const tokenIdParam = searchParams.get("tokenId");

    // Check for required parameters
    if (!nftContract) {
      return NextResponse.json(
        { error: "nftContract parameter is required" },
        { status: 400 }
      );
    }

    let query;
    let values;

    // Delete specific token or all tokens for a contract
    if (tokenIdParam) {
      const tokenId = parseInt(tokenIdParam);
      query = `DELETE FROM listings WHERE nft_contract = $1 AND token_id = $2 RETURNING *`;
      values = [nftContract, tokenId];
      console.log(
        `Attempting to delete listing for contract ${nftContract}, token ${tokenId}`
      );
    } else {
      query = `DELETE FROM listings WHERE nft_contract = $1 RETURNING *`;
      values = [nftContract];
      console.log(
        `Attempting to delete all listings for contract ${nftContract}`
      );
    }

    // Execute the query
    const result = await pool.query(query, values);

    // Return the number of deleted items
    return NextResponse.json({
      success: true,
      deletedCount: result.rowCount,
      message: tokenIdParam
        ? `Cleared listing for token ${tokenIdParam} of contract ${nftContract}`
        : `Cleared all listings for contract ${nftContract}`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error clearing listings:", errorMessage);
    return NextResponse.json(
      { error: `Failed to clear listings: ${errorMessage}` },
      { status: 500 }
    );
  }
}
