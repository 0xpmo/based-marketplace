"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

// SWR configuration for app-wide data caching
const swrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 10000, // 10 seconds
  provider: () => new Map(),
};

export default function SWRProvider({ children }: { children: ReactNode }) {
  return <SWRConfig value={swrOptions}>{children}</SWRConfig>;
}
