# Based Sea NFT Marketplace

This is an NFT marketplace built on the Based AI blockchain. The marketplace allows users to:

- Create and list NFTs for sale
- Buy and sell NFTs
- View NFT collections and individual items
- Manage their NFT inventory

## Deployment Instructions

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

4. Deploy contracts (choose one option)

Option A: Deploy using Ignition (simpler, good for local testing)

```bash
npx hardhat ignition deploy ./ignition/modules/deploy.ts --network localhost
```

Option B: Deploy using upgradeable script (recommended for production-like testing)

```bash
npx hardhat run scripts/deploy-marketplace.ts --network localhost
```

5. Load contract addresses into environment

```bash
export $(cat contracts/.env.deployment | grep -v '#' | xargs)
```

6. Verify deployment

```bash
npx ts-node scripts/verify-deployment.ts --network localhost
```

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

1. Update .env file with your private key and RPC URL

   - Set `BASED_AI_RPC_URL` and `BASED_AI_PRIVATE_KEY` in .env

2. Compile contracts

```bash
npx hardhat compile
```

3. Deploy contracts to Based AI mainnet

```bash
npx hardhat run scripts/deploy-marketplace.ts --network basedai
```

4. Load contract addresses into environment

```bash
export $(cat contracts/.env.deployment | grep -v '#' | xargs)
```

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

8. Build and start the frontend

```bash
cd ../frontend
npm run build
npm run start
```
