// frontend/src/app/api/contracts/route.ts
import { NextResponse } from "next/server";
import {
  NFT_FACTORY_ADDRESS,
  MARKETPLACE_ADDRESS,
} from "@/constants/addresses";

// Contract addresses - using constants from shared location
const CONTRACTS = {
  factory: NFT_FACTORY_ADDRESS,
  marketplace: MARKETPLACE_ADDRESS,
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
