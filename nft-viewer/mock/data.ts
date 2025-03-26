import { Collection, NFT } from "../types";

export const mockCollections: Collection[] = [
  {
    id: "1",
    name: "Crypto Punks",
    symbol: "PUNK",
    description: "A collection of 10,000 unique pixel art characters",
    external_link: "https://cryptopunks.app",
    image:
      "https://ipfs.io/ipfs/QmTDcCdt3yb6mZitzWBmQr85qDvjX6MZ2CqdMnHEiNqDpG",
    contract_address: "0x1234567890123456789012345678901234567890",
    max_supply: 10000,
    mint_price: "0.05",
    creator: "0xabcdef1234567890abcdef1234567890abcdef12",
    items_count: 100,
  },
  {
    id: "2",
    name: "Based Bears",
    symbol: "BEAR",
    description: "A collection of cute bear NFTs",
    external_link: "https://basedbears.com",
    image:
      "https://ipfs.io/ipfs/QmYGh7zxkKPwgTzBNxJy7cTgQRj516Qj1BssTLTrX1PQbN",
    contract_address: "0x0987654321098765432109876543210987654321",
    max_supply: 5000,
    mint_price: "0.02",
    creator: "0xfedcba0987654321fedcba0987654321fedcba09",
    items_count: 50,
  },
];

export const mockNFTs: NFT[] = [
  {
    id: "1-1",
    name: "Crypto Punk #1",
    description: "A unique punk with rare attributes",
    image:
      "https://ipfs.io/ipfs/QmdD8FgtEKbjEPR5xkUdLTyrZw76F8GLKv8zYrfsu3xuP9",
    attributes: [
      { trait_type: "Background", value: "Blue" },
      { trait_type: "Species", value: "Human" },
      { trait_type: "Hair", value: "Mohawk" },
    ],
    collection_id: "1",
    token_id: 1,
  },
  {
    id: "1-2",
    name: "Crypto Punk #2",
    description: "A unique punk with uncommon attributes",
    image:
      "https://ipfs.io/ipfs/QmTK8mJAFHtfkuGRRWvmQiL4SdFcxDxAjbXGLKQ7QQhRa9",
    attributes: [
      { trait_type: "Background", value: "Red" },
      { trait_type: "Species", value: "Alien" },
      { trait_type: "Accessory", value: "Pipe" },
    ],
    collection_id: "1",
    token_id: 2,
  },
  {
    id: "2-1",
    name: "Based Bear #1",
    description: "A cute bear with unique traits",
    image:
      "https://ipfs.io/ipfs/QmbRVcAjWJ1VU2jpjJaWJHnFCcEbgy9bRcymSH2r9zFsY9",
    attributes: [
      { trait_type: "Background", value: "Forest" },
      { trait_type: "Fur", value: "Brown" },
      { trait_type: "Accessory", value: "Honey Pot" },
    ],
    collection_id: "2",
    token_id: 1,
  },
];
