import { useState } from "react";
import { useAccount } from "wagmi";
import { Listing } from "@/types/listings";
import { formatNumberWithCommas } from "@/utils/formatting";
import { ethers } from "ethers";
import PepeButton from "@/components/ui/PepeButton";
import { motion } from "framer-motion";

interface NFTListingsTableProps {
  listings: Listing[];
  onBuyClick: (listing: Listing) => void;
  onCancelClick: (listing: Listing) => void;
  onCreateListing: () => void;
  calculateUSDPrice?: (price: string) => string | null;
  userBalance?: number;
  isLoadingListings?: boolean;
}

const NFTListingsTable = ({
  listings,
  onBuyClick,
  onCancelClick,
  onCreateListing,
  calculateUSDPrice,
  userBalance = 0,
  isLoadingListings = false,
}: NFTListingsTableProps) => {
  const { address: userAddress } = useAccount();

  // Sort listings by price (lowest first)
  const sortedListings = [...listings].sort((a, b) => {
    const priceA = BigInt(a.price);
    const priceB = BigInt(b.price);
    return priceA < priceB ? -1 : 1;
  });

  if (isLoadingListings) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-blue-900/30 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-blue-900/20 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-100">Listings</h2>
        {userBalance > 0 && !listings.some((l) => l.seller === userAddress) && (
          <PepeButton
            variant="primary"
            onClick={onCreateListing}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
          >
            Create Listing
          </PepeButton>
        )}
      </div>

      {sortedListings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-blue-800/30">
                <th className="pb-4 text-blue-300 font-medium">Price</th>
                <th className="pb-4 text-blue-300 font-medium">USD Price</th>
                <th className="pb-4 text-blue-300 font-medium">Quantity</th>
                <th className="pb-4 text-blue-300 font-medium">Seller</th>
                <th className="pb-4 text-blue-300 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sortedListings.map((listing) => (
                <motion.tr
                  key={`${listing.seller}-${listing.price}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-b border-blue-800/20 hover:bg-blue-900/20 transition-colors"
                >
                  <td className="py-4">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-white">
                        {formatNumberWithCommas(
                          ethers.formatEther(listing.price)
                        )}
                      </span>
                      <span className="ml-2 text-blue-300">𝔹</span>
                    </div>
                  </td>
                  <td className="py-4">
                    {calculateUSDPrice && (
                      <span className="text-blue-300">
                        $
                        {formatNumberWithCommas(
                          calculateUSDPrice(
                            ethers.formatEther(listing.price)
                          ) || "0"
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-4">
                    <span className="text-blue-100">
                      {listing.quantity || 1} available
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="text-blue-100 font-medium">
                      {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    {listing.seller === userAddress ? (
                      <PepeButton
                        variant="outline"
                        onClick={() => onCancelClick(listing)}
                        className="text-sm px-4"
                      >
                        Cancel
                      </PepeButton>
                    ) : (
                      <PepeButton
                        variant="primary"
                        onClick={() => onBuyClick(listing)}
                        className="text-sm px-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                      >
                        Buy
                      </PepeButton>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-blue-900/20 rounded-lg border border-blue-800/30">
          <p className="text-blue-300 mb-4">No active listings</p>
          {userBalance > 0 && (
            <PepeButton
              variant="primary"
              onClick={onCreateListing}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
            >
              Create the first listing
            </PepeButton>
          )}
        </div>
      )}
    </div>
  );
};

export default NFTListingsTable;
