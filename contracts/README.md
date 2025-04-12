# How to run

Start a local Hardhat node in a separate terminal window:

```shell
npx hardhat node
```

Run the contract tests to ensure everything works correctly:

```shell
npx hardhat test
```

## Deployment Options

````

### Option 2: Deploy using Upgradeable Script (recommended for production)

Deploy all contracts as upgradeable (except BasedNFTCollection):

```shell
npx hardhat run scripts/newest-deploy-marketplace.ts --network localhost
````

This deploys:

- BasedCollectionFactory as upgradeable (UUPS)
- BasedMarketplaceStorage as upgradeable (UUPS)
- BasedMarketplace as upgradeable (UUPS)

## After Deployment

### Important

Env vars (address updates) should automatically be copied into .env in (/contracts directory), but if it isn't manually copy them.

Verify the deployment:

```shell
npx ts-node scripts/verify-deployment.ts --network localhost
```

Prepare the frontend by copying the ABIs and updating contract addresses:

```shell
npx ts-node scripts/copy-abis.ts
npx ts-node scripts/update-frontend-contracts.ts
```

Start the frontend development server:

```shell
cd ../frontend
npm run dev
```
