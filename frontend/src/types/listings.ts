export interface Listing {
  id: string;
  nftContract: string;
  tokenId: string;
  seller: string;
  price: string;
  quantity: number;
  isPrivate: boolean;
  allowedBuyer: string | null;
  status: "Active" | "Sold" | "Canceled";
  listingId: string;
  isERC1155: boolean;
  timestamp: number;
}

export interface ListingsResponse {
  listings: Listing[];
}

export interface ListingResponse {
  listing: Listing | null;
}

export interface SuccessResponse {
  success: boolean;
}
