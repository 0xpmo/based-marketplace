import { useEffect, useState } from "react";

// Create a simple loading overlay for blockchain transactions
function BlockchainLoadingIndicator() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Listen for custom events to show/hide loading indicator
  useEffect(() => {
    const showLoading = (e: CustomEvent) => {
      setIsLoading(true);
      setMessage(e.detail?.message || "Processing blockchain transaction...");
    };

    const hideLoading = () => {
      setIsLoading(false);
      setMessage("");
    };

    // Add event listeners
    window.addEventListener(
      "blockchain:loading:show" as any,
      showLoading as EventListener
    );
    window.addEventListener("blockchain:loading:hide" as any, hideLoading);

    return () => {
      window.removeEventListener(
        "blockchain:loading:show" as any,
        showLoading as EventListener
      );
      window.removeEventListener("blockchain:loading:hide" as any, hideLoading);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-blue-900/90 rounded-xl border border-blue-700 p-6 max-w-md w-full shadow-xl">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-blue-200 text-lg font-medium">{message}</p>
          <p className="text-blue-300 text-sm mt-2">
            Please wait and confirm in your wallet if prompted
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TokenPriceProvider>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <Web3Modal projectId={projectId} ethereumClient={ethereumClient}>
              {children}
              <Toaster position="bottom-left" />
              <BlockchainLoadingIndicator />
            </Web3Modal>
          </QueryClientProvider>
        </WagmiProvider>
      </TokenPriceProvider>
    </ThemeProvider>
  );
}
