# Based Sea NFT Marketplace

This is an NFT marketplace built on the Based AI blockchain. The marketplace allows users to:

- Create and list NFTs for sale
- Buy and sell NFTs
- View NFT collections and individual items
- Manage their NFT inventory

## Deployment Instructions (in contracts/ directory)

### Local Development

1. Start a local Hardhat node (in a separate terminal)

```bash
npx hardhat node
```

2. Compile contracts

```bash
npx hardhat compile
```

3. Run tests

```bash
npx hardhat test
```

4. Deploy all contracts as upgradeable (except BasedNFTCollection):

```shell
npx hardhat run scripts/newest-deploy-marketplace.ts --network localhost
```

This deploys:

- BasedCollectionFactory as upgradeable (UUPS)
- BasedMarketplaceStorage as upgradeable (UUPS)
- BasedMarketplace as upgradeable (UUPS)

## After Deployment

### Important

Env vars (address updates) should automatically be copied into .env in (/contracts directory), but if it isn't manually copy them.

````

6. Verify deployment

```bash
npx ts-node scripts/verify-deployment.ts --network localhost
````

7. Copy ABIs to frontend

```bash
npx ts-node scripts/copy-abis.ts
```

8. Update frontend contract addresses

```bash
npx ts-node scripts/update-frontend-contracts.ts
```

9. Start frontend development server (in a separate terminal)

```bash
cd ../frontend
npm run dev
```

Access the marketplace at http://localhost:3000

### Production Deployment to Based AI Mainnet

1. Update .env file in contracts/ directory with your private key and RPC URL

   - Set `BASED_AI_MAINNET_RPC_URL` and `BASED_AI_MAINNET_PRIVATE_KEY` in .env

2. Compile contracts

```bash
npx hardhat compile
```

3. Deploy contracts to Based AI mainnet

```bash
npx hardhat run scripts/deploy-marketplace.ts --network basedai
```

4. Load contract addresses into environment

Env vars (address updates) should automatically be copied into .env in (/contracts directory), but if it isn't manually copy them.

5. Verify deployment

```bash
npx ts-node scripts/verify-deployment.ts --network basedai
```

6. Copy ABIs to frontend

```bash
npx ts-node scripts/copy-abis.ts
```

7. Update frontend contract addresses

```bash
npx ts-node scripts/update-frontend-contracts.ts
```

8. Build and start the frontend (deployment handled by Vercel)

```bash
cd ./frontend
npm run build
npm run start
```
