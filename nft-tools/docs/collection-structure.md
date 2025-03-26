# NFT Collection Structure

This document explains the folder structure and file organization for NFT collections in our system.

## Standard Collection Structure

A well-organized NFT collection follows this structure:

```
my-collection/
├── collection-config.json
├── deployment-info.json (generated after processing)
├── assets/
│   ├── images/
│   │   ├── 1.png
│   │   ├── 2.png
│   │   ├── 3.png
│   │   └── ...
│   └── metadata/
│       ├── metadata-template.json
│       ├── 1.json (generated)
│       ├── 2.json (generated)
│       ├── 3.json (generated)
│       ├── ...
│       ├── collection.json (generated)
│       └── final/ (generated directory for IPFS upload)
```

## Key Components

### 1. `collection-config.json`

This is the main configuration file for your collection. It contains:

- Basic information (name, symbol, description)
- Pricing and supply settings
- Royalty settings
- Trait definitions and rarities
- Pinata API credentials

Example:

```json
{
  "name": "My Collection",
  "symbol": "COLL",
  "description": "A collection of unique digital items",
  "external_link": "https://mycollection.com",
  "seller_fee_basis_points": 500,
  "fee_recipient": "0x123...",
  "mint_price": "0.05",
  "max_supply": 100,
  "enable_minting": true,
  "traits": {
    "Background": ["Red", "Blue", "Green"]
  },
  "rarities": {
    "Background": {
      "Red": 50,
      "Blue": 30,
      "Green": 20
    }
  },
  "pinata": {
    "api_key": "",
    "api_secret": "",
    "jwt": ""
  }
}
```

### 2. Image Files

- Place all your NFT images in the `assets/images/` directory
- Images should be named numerically (1.png, 2.png, etc.) for proper ordering
- Supported formats: PNG, JPG, JPEG, GIF
- Recommended resolution: 1024x1024 pixels (images will be resized if necessary)

### 3. Metadata Template

The `metadata-template.json` file serves as a blueprint for generating individual NFT metadata:

```json
{
  "name": "[NAME] #[ID]",
  "description": "[DESCRIPTION]",
  "image": "[IMAGE_URL]",
  "external_url": "[EXTERNAL_URL]/[ID]",
  "attributes": [
    {
      "trait_type": "Background",
      "value": "[BACKGROUND]"
    },
    {
      "trait_type": "Species",
      "value": "[SPECIES]"
    }
  ]
}
```

Placeholders like `[NAME]`, `[ID]`, etc. will be replaced with actual values during processing.

## Generated Files

After running the processing script, several files will be generated:

### 1. Individual Metadata Files

For each image, a corresponding JSON file will be created in the `assets/metadata/` directory:

```json
{
  "name": "My Collection #1",
  "description": "A collection of unique digital items",
  "image": "ipfs://QmXyz...",
  "external_url": "https://mycollection.com/1",
  "attributes": [
    {
      "trait_type": "Background",
      "value": "Blue"
    },
    {
      "trait_type": "Species",
      "value": "Lion"
    }
  ]
}
```

### 2. Collection Metadata

A `collection.json` file with information about the collection as a whole:

```json
{
  "name": "My Collection",
  "description": "A collection of unique digital items",
  "image": "ipfs://QmXyz...",
  "external_link": "https://mycollection.com",
  "seller_fee_basis_points": 500,
  "fee_recipient": "0x123..."
}
```

### 3. Deployment Info

After processing (and deployment if chosen), a `deployment-info.json` file will be created:

```json
{
  "name": "My Collection",
  "symbol": "COLL",
  "contractURI": "ipfs://QmAbc...",
  "metadataBaseUri": "ipfs://QmXyz.../",
  "maxSupply": 100,
  "mintPrice": "50000000000000000",
  "royaltyFee": 500,
  "enableMinting": true,
  "timestamp": "2023-07-01T12:34:56.789Z",
  "collectionAddress": "0x123...",
  "factoryAddress": "0x456...",
  "deployedAt": "2023-07-01T12:45:23.456Z",
  "deployerAddress": "0x789...",
  "transactionHash": "0xabc..."
}
```

## Best Practices

1. **Image Naming**: Use sequential numbering for images to ensure they map correctly to token IDs
2. **Image Quality**: Use high-quality images with transparent backgrounds when possible
3. **Traits Consistency**: Ensure all trait types in your template match those in your config
4. **Secure Credentials**: Never commit your Pinata API keys to version control
5. **Backup**: Always keep a backup of your original images and metadata

## Related Documentation

- [Metadata Standards](metadata-standards.md) - For more details on metadata format
- [Deployment Options](deployment-options.md) - For various deployment configurations
