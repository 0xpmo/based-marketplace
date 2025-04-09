-- Create listings table
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    seller VARCHAR(42) NOT NULL,
    nft_contract VARCHAR(42) NOT NULL,
    token_id BIGINT NOT NULL,
    price DECIMAL(78, 18) NOT NULL,
    price_wei VARCHAR(78) NOT NULL, 
    is_private BOOLEAN NOT NULL DEFAULT false,
    allowed_buyer VARCHAR(42),
    status SMALLINT NOT NULL DEFAULT 1, -- 0=None, 1=Active, 2=Sold, 3=Canceled
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(nft_contract, token_id, status) -- Enforce only one active listing per token
);

-- Index for faster collection-based queries
CREATE INDEX idx_listings_contract_status ON listings(nft_contract, status);

-- Index for seller queries
CREATE INDEX idx_listings_seller ON listings(seller);

-- Note: This constraint may cause issues if you need multiple listings with different statuses
-- If so, modify the constraint to only apply to active listings (status = 1)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_nft_contract_token_id_status_key;
CREATE UNIQUE INDEX idx_unique_active_listing ON listings(nft_contract, token_id) WHERE status = 1; 