// frontend/src/app/api/contracts/route.ts
import { NextResponse } from "next/server";

// Contract addresses - update these after deployment
const CONTRACTS = {
  factory:
    process.env.FACTORY_ADDRESS || "0x0000000000000000000000000000000000000000",
  marketplace:
    process.env.MARKETPLACE_ADDRESS ||
    "0x0000000000000000000000000000000000000000",
};

export async function GET() {
  return NextResponse.json({
    contracts: CONTRACTS,
    network: {
      name: process.env.NETWORK_NAME || "Based AI",
      chainId: process.env.CHAIN_ID || "54321",
    },
  });
}
