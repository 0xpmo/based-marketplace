import { ethers } from "ethers";
import { getActiveChain } from "@/config/chains";

// Add simplified type definition for window.ethereum
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
  }
}

// Get default provider
export const getDefaultProvider = async () => {
  // Client-side only
  if (typeof window === "undefined") {
    // Use a server-side provider instead of throwing an error
    return getServerProvider();
  }

  // Use the browser's ethereum provider if available
  if (window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }

  // Fallback to a server provider
  return getServerProvider();
};

// Server-side provider for API routes
export const getServerProvider = () => {
  // Get the active chain based on environment
  const chain = getActiveChain();

  // Use the appropriate RPC URL from the chain config
  const rpcUrl = chain.rpcUrls.default.http[0];

  return new ethers.JsonRpcProvider(rpcUrl);
};
