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

### Option 1: Deploy using Ignition (for local development)

Deploy the contracts locally using Ignition:

```shell
npx hardhat ignition deploy ./ignition/modules/deploy.ts --network localhost
```

If need to reset:

```shell
npx hardhat ignition deploy ./ignition/modules/deploy.ts --network localhost --reset
```

### Option 2: Deploy using Upgradeable Script (recommended for production)

Deploy all contracts as upgradeable (except BasedNFTCollection):

```shell
npx hardhat run scripts/deploy-marketplace.ts --network localhost
```

This deploys:

- BasedCollectionFactory as upgradeable (Transparent Proxy)
- BasedMarketplaceStorage as upgradeable (UUPS)
- BasedMarketplace as upgradeable (UUPS)

## After Deployment

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

## Upgrading Contracts

To upgrade the contracts in the future, use the appropriate script:

```shell
# For BasedCollectionFactory
npx hardhat run scripts/upgrade-factory-to-v2.ts --network localhost

# For BasedMarketplace and BasedMarketplaceStorage
npx hardhat run scripts/upgrade-marketplace.ts --network localhost
```

Make sure to set the required environment variables before running upgrade scripts:

- FACTORY_PROXY_ADDRESS
- MARKETPLACE_ADDRESS
- MARKETPLACE_STORAGE_ADDRESS
