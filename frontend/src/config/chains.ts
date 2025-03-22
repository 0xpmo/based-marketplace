import { defineChain } from "viem";

export const chains = {
  local: defineChain({
    id: 1337,
    name: "Local Chain",
    nativeCurrency: {
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
    },
    rpcUrls: {
      default: { http: ["http://127.0.0.1:8545"] },
    },
  }),

  basedAI: defineChain({
    id: 32323,
    name: "Based AI",
    nativeCurrency: {
      decimals: 18,
      name: "BasedAI",
      symbol: "BASED",
    },
    rpcUrls: {
      default: { http: ["https://mainnet.basedaibridge.com/rpc/"] },
    },
    blockExplorers: {
      default: {
        name: "Based AI Explorer",
        url: "https://explorer.getbased.ai",
      },
    },
  }),
} as const;

// Helper function to get the active chain based on environment
export const getActiveChain = () => {
  return process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN === "true"
    ? chains.local
    : chains.basedAI;
};
