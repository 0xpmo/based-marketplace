import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";

// Get the wallet connect project ID from environment variables
// Using the same project ID as before - this should work with the rebranded service
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  (process.env.NODE_ENV === "development" ? "development_mock_key" : "");

// Warn if no real project ID is set
if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn(
    "⚠️ No WalletConnect Project ID found in environment variables. " +
      "Some wallet connections may not work properly. " +
      "Get a project ID from https://cloud.walletconnect.com and add it to your .env.local file."
  );
}

// App metadata for Reown WalletKit
const metadata = {
  name: "BasedSea",
  description:
    "Discover, collect, and trade unique NFTs on the Based AI blockchain.",
  url: "https://basedsea.xyz", // Default URL
  icons: ["https://basedsea.xyz/pepecoin-logo.jpg"],
};

// Modify the URL dynamically on the client side
if (typeof window !== "undefined") {
  metadata.url = window.location.origin;
}

// Create the core instance - only on client side
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let core: any = null;

// Async function to initialize WalletKit
export async function initWalletKit() {
  // Only initialize on client side
  if (typeof window === "undefined") {
    throw new Error("WalletKit can only be initialized in the browser");
  }

  // Initialize core if not already done
  if (!core) {
    core = new Core({
      projectId,
    });
  }

  try {
    return await WalletKit.init({
      core,
      metadata,
    });
  } catch (error) {
    console.error("Failed to initialize WalletKit:", error);
    throw error;
  }
}

// Export the core getter function to ensure it's only used on client
export function getCore() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!core) {
    core = new Core({
      projectId,
    });
  }

  return core;
}
