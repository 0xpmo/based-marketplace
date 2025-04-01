import { NextRequest, NextResponse } from "next/server";
import { getServerProvider } from "@/lib/web3";
import CollectionABI from "@/contracts/BasedSeaSequentialNFTCollection.json";
import { ethers } from "ethers";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const txHash = searchParams.get("txHash");
    const collectionAddress = searchParams.get("collection");

    if (!txHash) {
      return NextResponse.json(
        { error: "Transaction hash is required" },
        { status: 400 }
      );
    }

    if (!collectionAddress) {
      return NextResponse.json(
        { error: "Collection address is required" },
        { status: 400 }
      );
    }

    // Get provider
    const provider = getServerProvider();

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return NextResponse.json(
        { error: "Transaction receipt not found" },
        { status: 404 }
      );
    }

    // Create interface to parse logs
    const collectionInterface = new ethers.Interface(CollectionABI.abi);

    // Normalize addresses for comparison (lowercase)
    const normalizedCollectionAddress = collectionAddress.toLowerCase();

    // Look for Transfer event in logs (ERC721 standard event for mints/transfers)
    // For a mint, the "from" address is typically the zero address
    // And ensure it's from the correct collection contract
    const transferEvents = receipt.logs
      .filter((log) => {
        // First check if this log is from the collection contract we're interested in
        const logAddress = log.address.toLowerCase();
        return logAddress === normalizedCollectionAddress;
      })
      .filter((log) => {
        try {
          const parsed = collectionInterface.parseLog(log);
          return (
            parsed &&
            parsed.name === "Transfer" &&
            parsed.args[0] === "0x0000000000000000000000000000000000000000"
          );
        } catch (e) {
          return false;
        }
      })
      .map((log) => {
        try {
          const parsed = collectionInterface.parseLog(log);
          // Only proceed if parsing succeeded
          if (parsed) {
            return {
              from: parsed.args[0],
              to: parsed.args[1],
              tokenId: parsed.args[2].toString(),
              blockNumber: receipt.blockNumber,
              logIndex: log.index, // This helps order events within the same block
            };
          }
          return null;
        } catch (e) {
          console.error("Error parsing log:", e);
          return null;
        }
      })
      .filter(
        (
          event
        ): event is {
          from: string;
          to: string;
          tokenId: string;
          blockNumber: number;
          logIndex: number;
        } => event !== null
      ); // Type guard to filter out nulls

    // Sort by block number and log index (descending) to get the latest event first
    transferEvents.sort((a, b) => {
      if (b.blockNumber !== a.blockNumber) {
        return b.blockNumber - a.blockNumber;
      }
      return b.logIndex - a.logIndex;
    });

    if (transferEvents.length > 0) {
      // Return the token ID from the latest mint event
      return NextResponse.json({
        tokenId: transferEvents[0].tokenId,
      });
    }

    // No Transfer event found
    return NextResponse.json(
      { error: "No mint events found in transaction" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error fetching transaction receipt:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction receipt" },
      { status: 500 }
    );
  }
}
