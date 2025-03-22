# How to run

Start a local Hardhat node in a separate terminal window:

```shell
npx hardhat node
```

Run the contract tests to ensure everything works correctly:

```shell
npx hardhat test
```

Deploy the contracts locally using Ignition:

```shell
npx hardhat ignition deploy ./ignition/modules/deploy.ts --network localhost
```

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
