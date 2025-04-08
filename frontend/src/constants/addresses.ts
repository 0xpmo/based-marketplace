// Contract addresses
export const MARKETPLACE_ADDRESS =
  process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
  "0x1234567890123456789012345678901234567890";
export const NFT_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "0x0987654321098765432109876543210987654321";

// A note for developers:
// If you're testing and these contracts don't exist on your chain yet,
// you'll need to deploy them first. The NFT detail view will still work
// but listing functionality will not be available until contracts are deployed.
