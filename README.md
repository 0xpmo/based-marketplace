# Deployment process (TESTING LOCALLY)

# Step 1: Start a local Hardhat node (in a separate terminal)

# This command starts a local Ethereum node with 20 pre-funded accounts

npx hardhat node

# Step 2: Compile contracts

npx hardhat compile

# Step 3: Run tests to ensure everything works properly

npx hardhat test

# Step 4: Deploy contracts using Ignition

npx hardhat ignition deploy ./ignition/modules/deploy.ts --network localhost

# Step 5: Verify deployment

npx ts-node scripts/verify-deployment.ts --network localhost

# Step 6: Copy ABIs to frontend

npx ts-node scripts/copy-abis.ts

# Step 7: Update frontend contract addresses

npx ts-node scripts/update-frontend-contracts.ts

# Step 8: Start frontend development server (in a separate terminal)

cd ../frontend
npm run dev

# Now you can access the marketplace at http://localhost:3000

# Deployment process (TO BASED MAINNET)

# Step 1: Update .env file with your private key and RPC URL

# Make sure BASED_AI_RPC_URL and BASED_AI_PRIVATE_KEY are set in .env

# Step 2: Compile contracts

npx hardhat compile

# Step 3: Deploy contracts to Based AI testnet

npx hardhat ignition deploy ./ignition/modules/deploy.ts --network basedai

# Step 4: Verify deployment

npx ts-node scripts/verify-deployment.ts --network basedai

# Step 5: Copy ABIs to frontend

npx ts-node scripts/copy-abis.ts

# Step 6: Update frontend contract addresses

npx ts-node scripts/update-frontend-contracts.ts

# Step 7: Update frontend .env.local with testnet details

echo "NEXT_PUBLIC_RPC_URL=https://testnet.basedai.blockchain" >> ../frontend/.env.local

# Step 8: Build and start the frontend

cd ../frontend
npm run build
npm run start
