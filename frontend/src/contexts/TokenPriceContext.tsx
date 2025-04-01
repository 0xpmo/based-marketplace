"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface TokenPriceContextType {
  tokenUSDRate: number | null;
  calculateUSDPrice: (tokenPrice: string) => string | null;
  formatNumberWithCommas: (value: number | string) => string;
  lastUpdated: Date | null;
  isLoading: boolean;
}

const TokenPriceContext = createContext<TokenPriceContextType | undefined>(
  undefined
);

export function useTokenPrice() {
  const context = useContext(TokenPriceContext);
  if (context === undefined) {
    throw new Error("useTokenPrice must be used within a TokenPriceProvider");
  }
  return context;
}

export function TokenPriceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tokenUSDRate, setTokenUSDRate] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Format numbers with commas for better readability
  const formatNumberWithCommas = (value: number | string) => {
    // Handle null, undefined or empty string
    if (!value && value !== 0) return "0";

    // Convert to string if it's not already
    const stringValue = String(value);

    // Split by decimal point if present
    const parts = stringValue.split(".");

    // Add commas to the integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Join back with decimal part if it exists
    return parts.join(".");
  };

  // Function to fetch token price in USD - centralized for the entire app
  const fetchTokenPriceInUSD = async (tokenSymbol = "BASEDAI") => {
    try {
      setIsLoading(true);

      // Check local storage cache first to reduce API calls
      const cachedData = localStorage.getItem("tokenPriceData");
      if (cachedData) {
        const { rate, timestamp } = JSON.parse(cachedData);
        const cacheTime = new Date(timestamp);
        const now = new Date();

        // Use cached price if it's less than 5 minutes old
        if (now.getTime() - cacheTime.getTime() < 5 * 60 * 1000) {
          setTokenUSDRate(rate);
          setLastUpdated(cacheTime);
          setIsLoading(false);
          return rate;
        }
      }

      // If cache is expired or doesn't exist, fetch new data
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=basedai&vs_currencies=usd`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch token price");
      }

      const data = await response.json();
      const rate = data["basedai"]?.usd || null;

      // Cache the result in localStorage
      if (rate !== null) {
        localStorage.setItem(
          "tokenPriceData",
          JSON.stringify({
            rate,
            timestamp: new Date().toISOString(),
          })
        );

        setTokenUSDRate(rate);
        setLastUpdated(new Date());
      }

      return rate;
    } catch (error) {
      console.error("Error fetching token price:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate USD price
  const calculateUSDPrice = (tokenPrice: string) => {
    if (!tokenPrice || !tokenUSDRate) return null;

    const usdValue = (parseFloat(tokenPrice) * tokenUSDRate) / 1000; // divide by 1000 for denomination change
    // Format to 2 decimal places
    return usdValue.toFixed(2);
  };

  // Fetch token price on component mount and refresh periodically
  useEffect(() => {
    fetchTokenPriceInUSD();

    // Refresh price every 5 minutes
    const intervalId = setInterval(() => {
      fetchTokenPriceInUSD();
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const value = {
    tokenUSDRate,
    calculateUSDPrice,
    formatNumberWithCommas,
    lastUpdated,
    isLoading,
  };

  return (
    <TokenPriceContext.Provider value={value}>
      {children}
    </TokenPriceContext.Provider>
  );
}
