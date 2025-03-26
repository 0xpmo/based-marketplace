# Based NFT Viewer

A simple Next.js application to view NFT collections created with the Based Marketplace NFT Collection Tools.

## Features

- View all created NFT collections
- Browse NFTs within each collection
- View detailed information about each NFT
- See traits and attributes for NFTs

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd nft-viewer
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Run the development server

```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application

## Viewing Real NFT Collections

This viewer is designed to display NFT collections created using the Based Marketplace NFT Collection Tools. By default, it will look for collections in the `../nft-tools/collections` directory.

### How to Connect to Your NFT Collections

1. Create an NFT collection using the Based Marketplace NFT Collection Tools:

```bash
# Go to nft-tools directory
cd ../nft-tools

# Create a new collection from template
cp -r templates/collection-template my-collection

# Configure and add images to my-collection

# Process the collection
./process-collection.js --collection ./my-collection
```

2. After processing, the NFT collection will be available in the `nft-tools/collections/` directory.

3. In the NFT Viewer app, make sure the environment variable is set to use real data:

```
# .env.local
NEXT_PUBLIC_USE_MOCK_DATA=false
```

4. Restart the development server and your collections will be displayed in the app.

### Switching Between Mock and Real Data

To toggle between mock data and real collections:

1. Edit the `.env.local` file in the project root:

   - Set `NEXT_PUBLIC_USE_MOCK_DATA=true` to use mock data
   - Set `NEXT_PUBLIC_USE_MOCK_DATA=false` to use real collections

2. Restart the development server for changes to take effect.

## Project Structure

- `app/`: Next.js App Router pages
- `types/`: TypeScript type definitions
- `mock/`: Mock data for development
- `utils/`: Utility functions
  - `collections.ts`: Functions to fetch collection data
  - `nft-tools-integration.ts`: Integration with the NFT Collection Tools

## Integration with NFT Collection Tools

This viewer is designed to display NFT collections created using the Based Marketplace NFT Collection Tools. It reads collection metadata and NFT data from the output of the collection processing script.

In a production environment, you would modify the utilities in `utils/collections.ts` to:

1. Read from the deployed collection registry
2. Fetch NFT data from IPFS or your preferred storage
3. Integrate with blockchain contracts via ethers.js

## Future Enhancements

- Connect to real blockchain data via ethers.js
- Add wallet connection for displaying owned NFTs
- Add minting functionality for new collections
- Implement searching and filtering capabilities
