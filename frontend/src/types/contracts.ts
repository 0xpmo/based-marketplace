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
}

export interface CollectionMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface NFTItem {
  tokenId: number;
  owner: string;
  tokenURI?: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
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
