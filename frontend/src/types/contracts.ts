// frontend/src/types/contracts.ts
export interface Collection {
  address: string;
  name: string;
  symbol: string;
  collectionURI: string;
  mintPrice: string;
  maxSupply: number;
  totalMinted: number;
  royaltyFee: number;
  owner: string;
  metadata?: CollectionMetadata;
  mintEnabled?: boolean;
}

export interface CollectionMetadata {
  name: string;
  description: string;
  image: string;
  banner_image?: string;
  external_link?: string;
  seller_fee_basis_points?: number;
  fee_recipient?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface NFTItem {
  tokenId: number;
  tokenURI: string;
  owner: string;
  collection: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
    [key: string]: unknown;
  };
  listing?: {
    price: string;
    seller: string;
    active: boolean;
  };
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: {
    trait_type: string;
    value: string;
  }[];
}

export interface Listing {
  seller: string;
  nftContract: string;
  tokenId: number;
  price: string;
  active: boolean;
}
