export const FactoryABI = [
  {
    inputs: [],
    name: "getCollections",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "symbol", type: "string" },
      { internalType: "string", name: "collectionURI", type: "string" },
      { internalType: "uint256", name: "mintPrice", type: "uint256" },
      { internalType: "uint256", name: "maxSupply", type: "uint256" },
      { internalType: "uint256", name: "royaltyFee", type: "uint256" },
    ],
    name: "createCollection",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;
