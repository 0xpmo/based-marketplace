export interface Collection {
  id: string;
  name: string;
  symbol: string;
  description: string;
  external_link?: string;
  image?: string;
  contract_address?: string;
  max_supply: number;
  mint_price: string;
  creator: string;
  items_count: number;
}

export interface Trait {
  trait_type: string;
  value: string;
}

export interface NFT {
  id: string;
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: Trait[];
  collection_id: string;
  token_id: number;
}
