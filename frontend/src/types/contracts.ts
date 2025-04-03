// frontend/src/types/contracts.ts
export interface Collection {
  address: string;
  name: string;
  symbol: string;
  contractURI: string;
  mintPrice: string;
  totalSupply: number;
  maxSupply?: number;
  // totalMinted: number;
  royaltyFee: number;
  owner: string;
  metadata?: CollectionMetadata;
  mintingEnabled?: boolean;
  paused?: boolean;
  source?: "based" | "external"; // Indicates if the collection is from BasedFactory or external list
}

export interface CollectionMetadata {
  name: string;
  description: string;
  image: string;
  banner_image_url?: string;
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
    external_link?: string;
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

// New types for ERC1155
export enum KekTrumpsRarity {
  Bronze = 0,
  Silver = 1,
  Gold = 2,
  Green = 3,
}

export interface ERC1155Item {
  tokenId: number;
  characterId?: number;
  rarity?: number;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    external_link?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
    [key: string]: unknown;
  };
  supply: number;
  maxSupply: number;
  balance: number;
  uri?: string;
  listing?: {
    active: boolean;
    price: string;
    seller: string;
    quantity?: number;
  };
  collection: string;
}

export interface ERC1155Collection extends Collection {
  isERC1155: boolean;
  characters?: {
    characterId: number;
    name: string;
    enabled: boolean;
  }[];
  rarityPrices?: {
    [key: number]: string;
  };
  maxMintPerTx?: {
    [key: number]: number;
  };
}

export interface CharacterInfo {
  name: string;
  characterId: number;
  maxSupply: number[];
  minted: number[];
  burned: number[];
  tokenId: number[];
  enabled: boolean;
}
