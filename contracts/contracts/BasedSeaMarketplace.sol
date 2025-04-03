// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IBasedSeaMarketplaceStorage.sol";

/**
 * @title BasedSeaMarketplace
 * @dev NFT marketplace for BasedSea
 */
contract BasedSeaMarketplace is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ECDSA for bytes32;

    // ===== STATE VARIABLES =====

    // Reference to storage contract (via interface)
    IBasedSeaMarketplaceStorage public marketplaceStorage;

    // ===== TYPE DEFINITIONS =====

    /**
     * @dev Structure representing an offer to buy an NFT
     */
    struct SellerOffer {
        bytes32 offerId; // Unique identifier for the offer
        address nftContract; // NFT contract address
        uint256 tokenId; // NFT token ID
        uint256 price; // Offer price
        address buyer; // Address of the intended buyer (address(0) for public offers)
        uint256 expiration; // Timestamp when this offer expires
    }

    // ===== EVENTS =====

    // Listing events
    event ItemListed(
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price,
        bool isPrivate,
        address allowedBuyer,
        uint256 quantity
    );

    event ItemSold(
        address indexed seller,
        address indexed buyer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );

    event ItemCanceled(
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId
    );

    event UpdatedListing(
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 newPrice,
        uint256 newQuantity
    );

    // Bid events
    event OfferExecuted(
        address indexed seller,
        address indexed buyer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price,
        bytes32 offerId
    );

    event SaleCompletedWithPaymentIssue(
        address indexed seller,
        address indexed buyer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount
    );

    // Fee events
    event MarketFeeUpdated(uint256 newFee);
    event FeeRecipientUpdated(address newRecipient);
    event RoyaltiesStatusChanged(bool disabled);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    // Emergency events
    event EmergencyPaused(address indexed triggeredBy);
    event EmergencyUnpaused(address indexed triggeredBy);

    // Payment events
    event PaymentSent(
        address indexed recipient,
        uint256 amount,
        string paymentType
    );
    event PaymentFailed(
        address indexed recipient,
        uint256 amount,
        string paymentType
    );

    event FailedPaymentStored(address indexed recipient, uint256 amount);
    event FailedPaymentClaimed(address indexed recipient, uint256 amount);

    // ===== INITIALIZER =====

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract, setting up the storage connection
     * @param storageAddress Address of the storage contract
     */
    function initialize(address storageAddress) public initializer {
        require(storageAddress != address(0), "Invalid storage address");

        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        // Connect to storage contract via interface
        marketplaceStorage = IBasedSeaMarketplaceStorage(storageAddress);
    }

    /**
     * @dev Authorizes a contract upgrade using the UUPS pattern
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ===== MODIFIERS =====

    /**
     * @dev Modifier to prevent actions when contract is paused
     */
    modifier whenNotPaused() {
        require(!marketplaceStorage.paused(), "Contract is paused");
        _;
    }

    // ===== ADMINISTRATION FUNCTIONS =====

    /**
     * @dev Update storage contract reference
     * @param storageAddress New storage contract address
     */
    function setStorageContract(address storageAddress) external onlyOwner {
        require(storageAddress != address(0), "Invalid storage address");
        marketplaceStorage = IBasedSeaMarketplaceStorage(storageAddress);
    }

    /**
     * @dev Set the marketplace fee
     * @param _marketFee New fee in basis points (e.g., 250 = 2.5%)
     */
    function setMarketFee(uint256 _marketFee) external onlyOwner {
        require(_marketFee <= 1000, "Fee cannot exceed 10%");
        marketplaceStorage.setMarketFee(_marketFee);
        emit MarketFeeUpdated(_marketFee);
    }

    /**
     * @dev Set the fee recipient address
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        marketplaceStorage.setFeeRecipient(_feeRecipient);
        emit FeeRecipientUpdated(_feeRecipient);
    }

    /**
     * @dev Toggle royalty payments
     * @param _disabled Whether to disable royalties
     */
    function setRoyaltiesDisabled(bool _disabled) external onlyOwner {
        marketplaceStorage.setRoyaltiesDisabled(_disabled);
        emit RoyaltiesStatusChanged(_disabled);
    }

    /**
     * @dev Allow contract owner to pause all marketplace operations in emergency
     * @param _paused Whether to pause the contract
     */
    function setPaused(bool _paused) external onlyOwner {
        marketplaceStorage.setPaused(_paused);
        if (_paused) {
            emit EmergencyPaused(msg.sender);
        } else {
            emit EmergencyUnpaused(msg.sender);
        }
    }

    // ===== LISTING FUNCTIONS =====

    /**
     * @dev List an NFT for sale
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token to list
     * @param price Listing price in wei
     */
    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external whenNotPaused {
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
                nft.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );
        require(price > 0, "Price must be greater than zero");

        _createListing(
            nftContract,
            tokenId,
            msg.sender,
            price,
            false,
            address(0),
            1 // Always 1 for ERC721
        );
    }

    /**
     * @dev List an ERC1155 token for sale
     * @param nftContract Address of the ERC1155 contract
     * @param tokenId ID of the token to list
     * @param quantity Number of tokens to list
     * @param price Listing price per token in wei
     */
    function listERC1155Item(
        address nftContract,
        uint256 tokenId,
        uint256 quantity,
        uint256 price
    ) external whenNotPaused {
        // Check if it's an ERC1155 token
        require(
            IERC165(nftContract).supportsInterface(0xd9b67a26), // ERC1155 interface ID
            "Not an ERC1155 contract"
        );

        IERC1155 nft = IERC1155(nftContract);
        require(
            nft.balanceOf(msg.sender, tokenId) >= quantity,
            "Insufficient token balance"
        );
        require(
            nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );
        require(price > 0, "Price must be greater than zero");
        require(quantity > 0, "Quantity must be greater than zero");

        // Create a unique listing ID for this seller+tokenId combination
        uint256 listingId = _createERC1155ListingId(tokenId, msg.sender);

        // Use the standard _createListing function with our special ID
        _createListing(
            nftContract,
            listingId,
            msg.sender,
            price,
            false,
            address(0),
            quantity
        );

        // Emit event with original tokenId for frontend compatibility
        emit ItemListed(
            msg.sender,
            nftContract,
            tokenId, // Use original tokenId in events for frontend compatibility
            price,
            false,
            address(0),
            quantity
        );
    }

    /**
     * @dev Create a private listing for a specific buyer
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param price Listing price in wei per token
     * @param allowedBuyer Address of the allowed buyer
     * @param quantity Quantity of tokens (default 1 for ERC721)
     */
    function createPrivateListing(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address allowedBuyer,
        uint256 quantity
    ) external whenNotPaused {
        require(price > 0, "Price must be greater than zero");
        require(allowedBuyer != address(0), "Invalid buyer address");
        require(
            allowedBuyer != msg.sender,
            "Cannot create private listing for yourself"
        );

        // Check if it's an ERC1155 or ERC721
        bool isERC1155 = IERC165(nftContract).supportsInterface(0xd9b67a26);

        if (isERC1155) {
            // ERC1155 handling
            require(quantity > 0, "Quantity must be greater than zero");
            IERC1155 nft = IERC1155(nftContract);
            require(
                nft.balanceOf(msg.sender, tokenId) >= quantity,
                "Insufficient token balance"
            );
            require(
                nft.isApprovedForAll(msg.sender, address(this)),
                "Marketplace not approved"
            );
        } else {
            // ERC721 handling
            quantity = 1; // Always 1 for ERC721
            IERC721 nft = IERC721(nftContract);
            require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
            require(
                nft.isApprovedForAll(msg.sender, address(this)) ||
                    nft.getApproved(tokenId) == address(this),
                "Marketplace not approved"
            );
        }

        marketplaceStorage.setListing(
            nftContract,
            tokenId,
            msg.sender,
            price,
            true,
            allowedBuyer,
            quantity
        );

        emit ItemListed(
            msg.sender,
            nftContract,
            tokenId,
            price,
            true,
            allowedBuyer,
            quantity
        );
    }

    /**
     * @dev Get a listing
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @return The listing details
     */
    function getListing(
        address nftContract,
        uint256 tokenId
    ) external view returns (IBasedSeaMarketplaceStorage.Listing memory) {
        return marketplaceStorage.getListing(nftContract, tokenId);
    }

    /**
     * @dev Cancel a listing
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     */
    function cancelListing(address nftContract, uint256 tokenId) external {
        // Get listing details
        IBasedSeaMarketplaceStorage.Listing memory listing = marketplaceStorage
            .getListing(nftContract, tokenId);

        require(listing.seller == msg.sender, "Not the seller");
        require(
            listing.status == IBasedSeaMarketplaceStorage.ListingStatus.Active,
            "Listing not active"
        );

        // Update listing status
        marketplaceStorage.updateListingStatus(
            nftContract,
            tokenId,
            IBasedSeaMarketplaceStorage.ListingStatus.Canceled
        );

        emit ItemCanceled(msg.sender, nftContract, tokenId);
    }

    /**
     * @dev Cancel an ERC1155 listing
     * @param nftContract Address of the ERC1155 contract
     * @param tokenId Original token ID (not the combined ID)
     */
    function cancelERC1155Listing(
        address nftContract,
        uint256 tokenId
    ) external {
        // Generate the listing ID
        uint256 listingId = _createERC1155ListingId(tokenId, msg.sender);

        // Get listing details
        IBasedSeaMarketplaceStorage.Listing memory listing = marketplaceStorage
            .getListing(nftContract, listingId);

        require(listing.seller == msg.sender, "Not the seller");
        require(
            listing.status == IBasedSeaMarketplaceStorage.ListingStatus.Active,
            "Listing not active"
        );

        // Verify it's an ERC1155 token
        require(
            IERC165(nftContract).supportsInterface(0xd9b67a26), // ERC1155 interface ID
            "Not an ERC1155 contract"
        );

        // Update listing status
        marketplaceStorage.updateListingStatus(
            nftContract,
            listingId, // Use combined ID for storage
            IBasedSeaMarketplaceStorage.ListingStatus.Canceled
        );

        emit ItemCanceled(msg.sender, nftContract, tokenId); // Use original tokenId in events
    }

    /**
     * @dev Update the price of a listing
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param newPrice New listing price per token
     */
    function updateListingPrice(
        address nftContract,
        uint256 tokenId,
        uint256 newPrice
    ) external whenNotPaused {
        // Get listing details
        IBasedSeaMarketplaceStorage.Listing memory listing = marketplaceStorage
            .getListing(nftContract, tokenId);

        require(listing.seller == msg.sender, "Not the seller");
        require(
            listing.status == IBasedSeaMarketplaceStorage.ListingStatus.Active,
            "Listing not active"
        );
        require(newPrice > 0, "Price must be greater than zero");

        // Verify seller still owns the NFT
        try IERC721(nftContract).ownerOf(tokenId) returns (address owner) {
            require(owner == msg.sender, "Seller no longer owns this NFT");
        } catch {
            revert("Failed to verify NFT ownership");
        }

        // Update listing price
        marketplaceStorage.updateListingQuantityAndPrice(
            nftContract,
            tokenId,
            listing.quantity,
            newPrice
        );

        emit UpdatedListing(
            msg.sender,
            nftContract,
            tokenId,
            newPrice,
            listing.quantity
        );
    }

    /**
     * @dev Update the price and quantity of an ERC1155 listing
     * @param nftContract Address of the ERC1155 contract
     * @param tokenId Original token ID (not the combined ID)
     * @param newPrice New price per token
     * @param newQuantity New quantity
     */
    function updateERC1155ListingPrice(
        address nftContract,
        uint256 tokenId,
        uint256 newPrice,
        uint256 newQuantity
    ) external whenNotPaused {
        // Generate the listing ID
        uint256 listingId = _createERC1155ListingId(tokenId, msg.sender);

        // Get listing details
        IBasedSeaMarketplaceStorage.Listing memory listing = marketplaceStorage
            .getListing(nftContract, listingId);

        require(listing.seller == msg.sender, "Not the seller");
        require(
            listing.status == IBasedSeaMarketplaceStorage.ListingStatus.Active,
            "Listing not active"
        );
        require(newPrice > 0, "Price must be greater than zero");
        require(newQuantity > 0, "Quantity must be greater than zero");
        // Verify it's an ERC1155 token
        require(
            IERC165(nftContract).supportsInterface(0xd9b67a26), // ERC1155 interface ID
            "Not an ERC1155 contract"
        );

        // Verify seller still owns enough tokens
        IERC1155 nft = IERC1155(nftContract);
        require(
            nft.balanceOf(msg.sender, tokenId) >= newQuantity,
            "Insufficient token balance"
        );

        // Update listing price
        marketplaceStorage.updateListingQuantityAndPrice(
            nftContract,
            listingId,
            newQuantity,
            newPrice
        );

        emit UpdatedListing(
            msg.sender,
            nftContract,
            tokenId,
            newPrice,
            newQuantity
        ); // Use original tokenId in events
    }

    // ===== PURCHASE FUNCTIONS =====

    /**
     * @dev Buy a listed NFT
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     */
    function buyItem(
        address nftContract,
        uint256 tokenId
    ) external payable nonReentrant whenNotPaused {
        // Get listing details
        IBasedSeaMarketplaceStorage.Listing memory listing = marketplaceStorage
            .getListing(nftContract, tokenId);

        require(
            listing.status == IBasedSeaMarketplaceStorage.ListingStatus.Active,
            "Item not active"
        );
        require(msg.value >= listing.price, "Insufficient funds");

        // Check if this is a private listing
        if (listing.isPrivate) {
            require(
                msg.sender == listing.allowedBuyer,
                "Not authorized for this private listing"
            );
        }

        // Verify seller still owns the NFT
        IERC721 nft = IERC721(listing.nftContract);
        require(
            nft.ownerOf(listing.tokenId) == listing.seller,
            "Seller no longer owns this NFT"
        );

        // Mark as sold
        marketplaceStorage.updateListingStatus(
            nftContract,
            tokenId,
            IBasedSeaMarketplaceStorage.ListingStatus.Sold
        );

        // Process the payment and distribute funds
        _processSale(
            listing.nftContract,
            listing.tokenId,
            listing.seller,
            msg.sender,
            listing.price
        );

        emit ItemSold(
            listing.seller,
            msg.sender,
            listing.nftContract,
            listing.tokenId,
            listing.price
        );

        // Refund any excess payment
        uint256 excess = msg.value - listing.price;
        if (excess > 0) {
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            if (!success) {
                emit PaymentFailed(msg.sender, excess, "Excess refund");
            } else {
                emit PaymentSent(msg.sender, excess, "Excess refund");
            }
        }
    }

    /**
     * @dev Buy a listed ERC1155 token
     * @param nftContract Address of the ERC1155 contract
     * @param tokenId Original token ID (not the combined ID)
     * @param seller Address of the seller
     * @param quantity Number of tokens to buy
     */
    function buyERC1155Item(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 quantity
    ) external payable nonReentrant whenNotPaused {
        // Generate the same listing ID used when listing
        uint256 listingId = _createERC1155ListingId(tokenId, seller);

        // Get the listing using the combined ID
        IBasedSeaMarketplaceStorage.Listing memory listing = marketplaceStorage
            .getListing(nftContract, listingId);

        require(
            listing.status == IBasedSeaMarketplaceStorage.ListingStatus.Active,
            "Item not active"
        );

        require(quantity > 0, "Quantity must be greater than zero");
        require(quantity <= listing.quantity, "Cannot buy more than listed");

        // Calculate price based on proportion of tokens bought
        uint256 buyPrice = (listing.price * quantity) / listing.quantity;
        require(msg.value >= buyPrice, "Insufficient funds");

        // Check if this is a private listing
        if (listing.isPrivate) {
            require(
                msg.sender == listing.allowedBuyer,
                "Not authorized for this private listing"
            );
        }

        // Verify it's an ERC1155 token
        require(
            IERC165(nftContract).supportsInterface(0xd9b67a26),
            "Not an ERC1155 contract"
        );

        // Verify seller still owns enough tokens
        IERC1155 nft = IERC1155(nftContract);
        require(
            nft.balanceOf(seller, tokenId) >= quantity,
            "Seller has insufficient tokens"
        );

        // If buying all tokens, mark as sold, otherwise update quantity
        if (quantity == listing.quantity) {
            marketplaceStorage.updateListingStatus(
                nftContract,
                listingId, // Use combined ID for storage operations
                IBasedSeaMarketplaceStorage.ListingStatus.Sold
            );
        } else {
            // Update the listing with remaining quantity
            uint256 remainingQuantity = listing.quantity - quantity;
            // Update the listing with remaining quantity and adjusted price
            marketplaceStorage.updateListingQuantityAndPrice(
                nftContract,
                listingId,
                remainingQuantity,
                listing.price
            );
        }

        // Process the payment and transfer tokens
        // Note: We use the original tokenId for the actual transfer
        _processERC1155Sale(
            nftContract,
            tokenId, // Use original tokenId for token transfer
            quantity,
            seller,
            msg.sender,
            buyPrice
        );

        emit ItemSold(
            seller,
            msg.sender,
            nftContract,
            tokenId, // Use original tokenId in events
            buyPrice
        );

        // Refund any excess payment
        uint256 excess = msg.value - buyPrice;
        if (excess > 0) {
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            if (!success) {
                emit PaymentFailed(msg.sender, excess, "Excess refund");
            } else {
                emit PaymentSent(msg.sender, excess, "Excess refund");
            }
        }
    }

    // ===== BID/OFFER EXECUTION FUNCTION =====

    /**
     * @dev Execute an offer that was signed by a seller
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param price Offered price
     * @param seller Address of the seller
     * @param expiration Expiration timestamp for the offer
     * @param signature Signature from the seller
     */
    function executeOffer(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address seller,
        uint256 expiration,
        bytes calldata signature
    ) external payable nonReentrant whenNotPaused {
        require(nftContract != address(0), "Invalid NFT contract address");
        require(seller != address(0), "Invalid seller address");
        require(seller != msg.sender, "Seller cannot be buyer");
        require(price > 0, "Price must be greater than zero");
        require(
            expiration > block.timestamp,
            "Expiration must be in the future"
        );

        // Verify contract exists and is an NFT contract
        require(
            IERC165(nftContract).supportsInterface(0x80ac58cd), // ERC721 interface ID
            "Address is not an ERC721 contract"
        );

        // Vrify the NFT exists and seller still owns it
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == seller, "Seller doesn't own NFT");

        // Generate a unique offer ID - now including chain ID to prevent
        // replay attacks across chains
        bytes32 offerId = keccak256(
            abi.encode( // Changed from abi.encodePacked to abi.encode for safer encoding
                nftContract,
                tokenId,
                price,
                seller,
                msg.sender, // buyer
                expiration,
                block.chainid // Add chain ID to prevent cross-chain replay attacks
            )
        );

        // Verify the offer hasn't been used before
        require(!marketplaceStorage.isOfferUsed(offerId), "Offer already used");

        // Verify offer hasn't expired
        require(block.timestamp <= expiration, "Offer expired");

        // Verify correct payment amount
        require(msg.value >= price, "Insufficient payment");

        // Create the message hash that the seller would have signed
        // Including chain ID in the message hash
        bytes32 messageHash = keccak256(
            abi.encode( // Changed from abi.encodePacked for safer encoding
                nftContract,
                tokenId,
                price,
                msg.sender, // buyer
                expiration,
                address(this), // contract address
                block.chainid
            )
        );

        // Verify the signature came from the seller
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );
        address recoveredSigner = ECDSA.recover(
            ethSignedMessageHash,
            signature
        );
        require(recoveredSigner == seller, "Invalid seller signature");

        // Check if NFT is approved for marketplace
        require(
            nft.isApprovedForAll(seller, address(this)) ||
                nft.getApproved(tokenId) == address(this),
            "NFT not approved for marketplace"
        );

        // Mark offer as used to prevent replay
        marketplaceStorage.markOfferAsUsed(offerId);

        // Update listing if it exists
        IBasedSeaMarketplaceStorage.Listing memory listing = marketplaceStorage
            .getListing(nftContract, tokenId);

        if (
            listing.status ==
            IBasedSeaMarketplaceStorage.ListingStatus.Active &&
            listing.seller == seller
        ) {
            marketplaceStorage.updateListingStatus(
                nftContract,
                tokenId,
                IBasedSeaMarketplaceStorage.ListingStatus.Sold
            );
        }

        // Process the payment and transfer
        _processSale(nftContract, tokenId, seller, msg.sender, price);

        // Emit events
        emit OfferExecuted(
            seller,
            msg.sender,
            nftContract,
            tokenId,
            price,
            offerId
        );

        emit ItemSold(seller, msg.sender, nftContract, tokenId, price);

        // Refund any excess payment
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            if (!success) {
                emit PaymentFailed(msg.sender, excess, "Excess refund");
            } else {
                emit PaymentSent(msg.sender, excess, "Excess refund");
            }
        }
    }

    /**
     * @dev Get the message hash for creating an offer signature
     * @param nftContract NFT contract address
     * @param tokenId NFT token ID
     * @param price Offer price
     * @param buyer Address of the buyer
     * @param expiration Expiration timestamp
     * @return The hash that should be signed by the seller
     */
    function getOfferHash(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address buyer,
        uint256 expiration
    ) external view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    nftContract,
                    tokenId,
                    price,
                    buyer,
                    expiration,
                    address(this),
                    block.chainid
                )
            );
    }

    // ===== HELPER FUNCTIONS =====

    /**
     * @dev Creates a unique ID for ERC1155 listings by combining tokenId and seller
     * @param tokenId Original ERC1155 token ID
     * @param seller Address of the seller
     * @return Combined ID to use for storage
     */
    function _createERC1155ListingId(
        uint256 tokenId,
        address seller
    ) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(tokenId, seller)));
    }

    /**
     * @dev Internal function to create a new listing
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token to list
     * @param seller Address of the NFT owner who is selling
     * @param price Listing price in wei per token
     * @param isPrivate Whether this is a private listing
     * @param allowedBuyer If private, the address allowed to purchase (otherwise address(0))
     * @param quantity Quantity of tokens (1 for ERC721, variable for ERC1155)
     */
    function _createListing(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 price,
        bool isPrivate,
        address allowedBuyer,
        uint256 quantity
    ) internal {
        try
            marketplaceStorage.setListing(
                nftContract,
                tokenId,
                seller,
                price,
                isPrivate,
                allowedBuyer,
                quantity
            )
        {
            emit ItemListed(
                seller,
                nftContract,
                tokenId,
                price,
                isPrivate,
                allowedBuyer,
                quantity
            );
        } catch Error(string memory reason) {
            revert(
                string(abi.encodePacked("Failed to create listing: ", reason))
            );
        } catch (bytes memory) {
            revert("Failed to create listing due to unknown error");
        }
    }

    /**
     * @dev Process the sale payment and distribute funds
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param seller Address of the seller
     * @param buyer Address of the buyer
     * @param amount Total payment amount
     */
    // Split into smaller functions for stack management
    function _processSale(
        address nftContract,
        uint256 tokenId,
        address seller,
        address buyer,
        uint256 amount
    ) internal {
        // Calculate fees first with minimal variables
        uint256 marketFeeAmount = _calculateMarketFee(amount);

        // Transfer the NFT first
        _transferNFT(nftContract, tokenId, seller, buyer);

        // Handle royalty payments
        uint256 royaltyAmount = _handleRoyaltyPayment(
            nftContract,
            tokenId,
            amount
        );

        // Track marketplace fees
        marketplaceStorage.addAccumulatedFees(marketFeeAmount);
        emit PaymentSent(address(this), marketFeeAmount, "Marketplace fee");

        // Pay seller (remainder after fees and royalties)
        uint256 sellerAmount = amount - marketFeeAmount - royaltyAmount;
        _paySeller(seller, sellerAmount);
    }

    /**
     * @dev Process the ERC1155 sale payment and distribute funds
     */
    function _processERC1155Sale(
        address nftContract,
        uint256 tokenId,
        uint256 quantity,
        address seller,
        address buyer,
        uint256 amount
    ) internal {
        // Calculate fees with minimal variables
        uint256 marketFeeAmount = _calculateMarketFee(amount);

        // Transfer the tokens first
        _transferERC1155(nftContract, tokenId, quantity, seller, buyer);

        // Handle royalty payments
        uint256 royaltyAmount = _handleRoyaltyPayment(
            nftContract,
            tokenId,
            amount
        );

        // Track marketplace fees
        marketplaceStorage.addAccumulatedFees(marketFeeAmount);
        emit PaymentSent(address(this), marketFeeAmount, "Marketplace fee");

        // Pay seller (remainder after fees and royalties)
        uint256 sellerAmount = amount - marketFeeAmount - royaltyAmount;
        _paySeller(seller, sellerAmount);
    }

    /**
     * @dev Calculates the marketplace fee for a given amount
     * @param amount Total sale amount in wei
     * @return The calculated marketplace fee
     */
    function _calculateMarketFee(
        uint256 amount
    ) internal view returns (uint256) {
        return (amount * marketplaceStorage.marketFee()) / 10000;
    }

    /**
     * @dev Transfers ERC1155 tokens from seller to buyer
     * @param nftContract Address of the ERC1155 contract
     * @param tokenId ID of the token to transfer
     * @param quantity Number of tokens to transfer
     * @param seller Current owner of the tokens
     * @param buyer Recipient of the tokens
     */
    function _transferERC1155(
        address nftContract,
        uint256 tokenId,
        uint256 quantity,
        address seller,
        address buyer
    ) internal {
        IERC1155 nft = IERC1155(nftContract);
        try nft.safeTransferFrom(seller, buyer, tokenId, quantity, "") {
            // Success, do nothing
        } catch Error(string memory reason) {
            revert(
                string(abi.encodePacked("ERC1155 transfer failed: ", reason))
            );
        } catch {
            revert("ERC1155 transfer failed");
        }
    }

    /**
     * @dev Transfers an NFT from seller to buyer
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token to transfer
     * @param seller Current owner of the NFT
     * @param buyer Recipient of the NFT
     */
    function _transferNFT(
        address nftContract,
        uint256 tokenId,
        address seller,
        address buyer
    ) internal {
        try IERC721(nftContract).safeTransferFrom(seller, buyer, tokenId) {
            // Success, do nothing
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("NFT transfer failed: ", reason)));
        } catch {
            revert("NFT transfer failed");
        }
    }

    /**
     * @dev Processes royalty payments for an NFT sale
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token sold
     * @param amount Total sale amount
     * @return The amount paid as royalties
     */
    function _handleRoyaltyPayment(
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) internal returns (uint256) {
        if (marketplaceStorage.royaltiesDisabled()) {
            return 0;
        }

        // Try to get royalty info
        address royaltyReceiver;
        uint256 royaltyAmount;

        // Check for ERC2981 support
        if (
            IERC165(nftContract).supportsInterface(type(IERC2981).interfaceId)
        ) {
            (royaltyReceiver, royaltyAmount) = IERC2981(nftContract)
                .royaltyInfo(tokenId, amount);
        }

        // Process royalty payment if applicable
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            _sendPayment(royaltyReceiver, royaltyAmount, "Royalty");
            return royaltyAmount;
        }

        return 0;
    }

    /**
     * @dev Sends the sale proceeds to the seller
     * @param seller Address of the seller
     * @param amount Amount to send to the seller after fees and royalties
     */
    function _paySeller(address seller, uint256 amount) internal {
        _sendPayment(seller, amount, "Sale proceeds");
        // No need to emit the SaleCompletedWithPaymentIssue here as _sendPayment will handle failed payments
    }

    /**
     * @dev Sends a payment to a recipient address and handles payment failures
     * @param recipient Address to receive the payment
     * @param amount Amount to send
     * @param paymentType String describing the type of payment (for events)
     */
    function _sendPayment(
        address recipient,
        uint256 amount,
        string memory paymentType
    ) internal {
        (bool success, ) = payable(recipient).call{value: amount}("");

        if (!success) {
            // Store the failed payment for later claiming
            marketplaceStorage.addFailedPayment(recipient, amount);
            emit PaymentFailed(recipient, amount, paymentType);
        } else {
            emit PaymentSent(recipient, amount, paymentType);
        }
    }

    /**
     * @dev Allow users to claim their failed payments
     */
    function claimFailedPayment() external nonReentrant {
        uint256 amount = marketplaceStorage.failedPayments(msg.sender);
        require(amount > 0, "No failed payments to claim");

        // Update state before external call to prevent reentrancy
        marketplaceStorage.clearFailedPayment(msg.sender);

        // Send the payment
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit FailedPaymentClaimed(msg.sender, amount);
    }

    /**
     * @dev Check the amount of failed payments for a recipient
     * @param recipient Address to check
     * @return amount Amount of failed payments
     */
    function getFailedPaymentAmount(
        address recipient
    ) external view returns (uint256) {
        return marketplaceStorage.failedPayments(recipient);
    }

    /**
     * @dev Allow contract owner to withdraw accumulated marketplace fees
     */
    function withdrawAccumulatedFees() external onlyOwner nonReentrant {
        uint256 amount = marketplaceStorage.accumulatedFees();
        require(amount > 0, "No fees accumulated");

        // Reset accumulated fees to 0 before transfer to prevent reentrancy
        marketplaceStorage.resetAccumulatedFees();

        // Direct transfer to fee recipient
        (bool success, ) = payable(marketplaceStorage.feeRecipient()).call{
            value: amount
        }("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(marketplaceStorage.feeRecipient(), amount);
    }

    /**
     * @dev Get the current amount of accumulated fees
     * @return Amount of accumulated fees
     */
    function getAccumulatedFees() external view returns (uint256) {
        return marketplaceStorage.accumulatedFees();
    }

    /**
     * @dev Get royalty information for an NFT
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param salePrice Price of the sale
     * @return receiver Address of the royalty receiver
     * @return royaltyAmount Amount of the royalty
     */
    function _getRoyaltyInfo(
        address nftContract,
        uint256 tokenId,
        uint256 salePrice
    ) internal view returns (address receiver, uint256 royaltyAmount) {
        if (marketplaceStorage.royaltiesDisabled()) {
            return (address(0), 0);
        }

        // Try ERC2981 interface
        if (
            IERC165(nftContract).supportsInterface(type(IERC2981).interfaceId)
        ) {
            return IERC2981(nftContract).royaltyInfo(tokenId, salePrice);
        }

        return (address(0), 0);
    }

    /**
     * @dev Transfer ownership of the storage contract to a new owner
     * @param newOwner Address of the new owner
     */
    function transferStorageOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is the zero address");

        // Get the address of the storage contract
        address storageAddr = address(marketplaceStorage);

        // Cast it to OwnableUpgradeable
        OwnableUpgradeable ownableStorage = OwnableUpgradeable(storageAddr);

        // Now we can call transferOwnership
        ownableStorage.transferOwnership(newOwner);
    }

    /**
     * @dev Receive function to accept payments
     */
    receive() external payable {}
}
