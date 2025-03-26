# NFT Collection Tools

This toolkit helps you create, deploy, and manage NFT collections on the Based Marketplace.

## Features

- Process a folder of images and metadata into a structured NFT collection
- Upload assets to IPFS using Pinata
- Deploy NFT collections through the BasedCollectionFactory
- Generate randomized traits and attributes
- Track deployed collections in a registry

## Prerequisites

1. Node.js (v14+)
2. A Pinata account with API keys
3. Access to an Ethereum node (local or remote)
4. Some ETH for gas fees and collection creation fees

## Installation

```bash
# Install dependencies
cd nft-tools
npm install

# Make the script executable
chmod +x process-collection.js
```

## Quick Start

### 1. Prepare Your Collection

Create a new collection folder using our template:

```bash
cp -r templates/collection-template my-collection
```

Then:

1. Add your images to `my-collection/assets/images/`
2. Configure your collection in `my-collection/collection-config.json`
3. Add your Pinata API credentials to the config file

### 2. Process Your Collection

```bash
./process-collection.js --collection ./my-collection
```

This will:

- Optimize all your images
- Upload them to IPFS
- Generate metadata with randomized traits
- Upload metadata to IPFS
- Create a deployment info file

### 3. Deploy Your Collection

```bash
./process-collection.js --collection ./my-collection --deploy --network local
```

This will:

- Process your collection (as above)
- Deploy it through our BasedCollectionFactory
- Register it in our collections registry
- Provide you with the contract address and next steps

## Configuration Options

The `collection-config.json` file contains all settings for your collection:

```json
{
  "name": "My Collection",
  "symbol": "COLL",
  "description": "A unique digital collection",
  "external_link": "https://mycollection.com",
  "seller_fee_basis_points": 500,
  "fee_recipient": "0x123...",
  "mint_price": "0.05",
  "max_supply": 100,
  "enable_minting": true,
  "traits": {
    "Background": ["Red", "Blue", "Green"],
    "Species": ["Ape", "Lion", "Tiger"]
  },
  "rarities": {
    "Background": {
      "Red": 50,
      "Blue": 30,
      "Green": 20
    }
  },
  "pinata": {
    "api_key": "YOUR_PINATA_API_KEY",
    "api_secret": "YOUR_PINATA_SECRET_KEY",
    "jwt": "YOUR_PINATA_JWT"
  }
}
```

## Detailed Documentation

For more detailed instructions, check the docs folder:

- [Collection Structure](docs/collection-structure.md)
- [Metadata Standards](docs/metadata-standards.md)
- [Deployment Options](docs/deployment-options.md)
- [Troubleshooting](docs/troubleshooting.md)

## License

MIT
