// This file contains addresses of external collections to include in the marketplace
// Add collection addresses here to import them without needing a registry contract

export interface ExternalCollection {
  address: string;
  name?: string; // Optional display name (will be fetched from contract if not provided)
  description?: string; // Optional description
  isBasedContract?: boolean; // Whether this is a manually deployed BasedNFT contract
}

// List of external collection addresses to include in the marketplace
export const EXTERNAL_COLLECTIONS: ExternalCollection[] = [
  // Example external collection (uncomment and replace with real collection when ready)
  //   {
  //     address: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", // Example - Bored Ape Yacht Club
  //     name: "Bored Ape Yacht Club",
  //     description:
  //       "The Bored Ape Yacht Club is a collection of 10,000 unique Bored Ape NFTs.",
  //   },
  // Example of manually deployed BasedNFT contract
  // {
  //   address: "0x1234567890123456789012345678901234567890",
  //   name: "Manual BasedNFT",
  //   description: "A BasedNFT collection deployed manually",
  //   isBasedContract: true  // This flag indicates it's a BasedNFT contract
  // },
  // Add more external collections here as needed
  {
    address: "0x92c2075F517890ed333086F3c4e2bfC3EBF57B5d",
  },
  {
    address: "0xD81DcFBB84C6A29C0C074f701EcedDf6CbA7877f",
  },
  {
    address: "0x853eFb327eA5D8766265B78C5B9092e2A85a8F70",
  },
  {
    address: "0xD819b90F7a7f8E85639671D2951285573bbf8771",
  },
  {
    address: "0xA8A1087C73e9D6980B42dF91149f96b99F75970E",
  },
];
