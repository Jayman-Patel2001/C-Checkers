"use client";

import { SWRConfig } from "swr";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,      // don't refetch every time window regains focus
        revalidateOnReconnect: false,  // don't refetch on network reconnect
        dedupingInterval: 10000,       // dedupe identical requests within 10 seconds
      }}
    >
      {children}
    </SWRConfig>
  );
}
