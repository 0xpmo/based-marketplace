// frontend/src/app/api/contracts/readCollection/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { getActiveChain } from "@/config/chains";
import { CollectionABI } from "@/contracts/abis/CollectionABI";

// Create a public client based on environment
const client = createPublicClient({
  chain: getActiveChain(),
  transport: http(),
});

// Valid property names from the ABI
const validProperties = [
  "name",
  "symbol",
  "collectionURI",
  "mintPrice",
  "maxSupply",
  "totalMinted",
  "royaltyFee",
  "owner",
] as const;

type ValidProperty = (typeof validProperties)[number];

// Type guard for property names
function isValidProperty(property: string): property is ValidProperty {
  return validProperties.includes(property as ValidProperty);
}

export async function GET(request: Request) {
  // Get query parameters
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const propertyParam = searchParams.get("property");

  // Validate parameters
  if (!address || !propertyParam) {
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  }

  // Validate property name
  if (!isValidProperty(propertyParam)) {
    return NextResponse.json(
      {
        error: "Invalid property name",
        validProperties,
      },
      { status: 400 }
    );
  }

  try {
    console.log(`Reading property ${propertyParam} from contract ${address}`);

    // Read the contract property
    const data = await client.readContract({
      address: address as `0x${string}`,
      abi: CollectionABI,
      functionName: propertyParam,
    });

    console.log(`Successfully read ${propertyParam}:`, data);

    // Convert BigInt to string if necessary
    const serializedData = typeof data === "bigint" ? data.toString() : data;

    return NextResponse.json({ result: serializedData });
  } catch (error) {
    // Log the full error
    console.error("Error reading contract:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return a structured error response
    return NextResponse.json(
      {
        error: "Failed to read contract property",
        details: error instanceof Error ? error.message : "Unknown error",
        property: propertyParam,
        address,
      },
      { status: 500 }
    );
  }
}
