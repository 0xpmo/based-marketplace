// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./IBasedMarketplaceStorage.sol";

contract BasedMarketplace is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Reference to storage contract (via interface)
    IBasedMarketplaceStorage public marketplaceStorage;

    // Events
    event ItemListed(
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price,
        bool isPrivate,
        address allowedBuyer
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
    event MarketFeeUpdated(uint256 newFee);
    event BidPlaced(
        address indexed bidder,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount
    );
    event BidAccepted(
        address indexed seller,
        address indexed bidder,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount
    );
    event BidWithdrawn(
        address indexed bidder,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount
    );
    event UpdatedListing(
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 newPrice
    );
    event EmergencyPaused(address indexed triggeredBy);
    event EmergencyUnpaused(address indexed triggeredBy);
    event RoyaltyTransferFailed(
        address indexed nft,
        uint256 indexed tokenId,
        address receiver,
        uint256 amount
    );
    event FeesWithdrawn(address indexed owner, uint256 amount);
    event FundsAddedToWithdraw(address indexed user, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address storageAddress) public initializer {
        require(storageAddress != address(0), "Invalid storage address");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        // Connect to storage contract via interface
        marketplaceStorage = IBasedMarketplaceStorage(storageAddress);

        // NOTE: Storage configuration values should be set by the deployer before
        // transferring ownership to this contract, as this contract doesn't
        // own the storage contract during initialization
    }

    // Required for UUPS upgradeable pattern
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // Update storage contract reference
    function setStorageContract(address storageAddress) external onlyOwner {
        require(storageAddress != address(0), "Invalid storage address");
        marketplaceStorage = IBasedMarketplaceStorage(storageAddress);
    }

    // Modifier to prevent actions when contract is paused
    modifier whenNotPaused() {
        require(!marketplaceStorage.paused(), "Contract is paused");
        _;
    }

    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) public whenNotPaused {
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
                nft.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );
        require(price > 0, "Price must be greater than zero");

        marketplaceStorage.setListing(
            nftContract,
            tokenId,
            msg.sender,
            price,
            true,
            false,
            address(0)
        );

        marketplaceStorage.updateListingStatus(
            nftContract,
            tokenId,
            IBasedMarketplaceStorage.ListingStatus.Active
        );

        emit ItemListed(
            msg.sender,
            nftContract,
            tokenId,
            price,
            false,
            address(0)
        );
    }

    // Create a private listing for a specific buyer
    function createPrivateListing(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address allowedBuyer
    ) public whenNotPaused {
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
                nft.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );
        require(price > 0, "Price must be greater than zero");
        require(allowedBuyer != address(0), "Invalid buyer address");
        require(
            allowedBuyer != msg.sender,
            "Cannot create private listing for yourself"
        );

        marketplaceStorage.setListing(
            nftContract,
            tokenId,
            msg.sender,
            price,
            true,
            true,
            allowedBuyer
        );

        marketplaceStorage.updateListingStatus(
            nftContract,
            tokenId,
            IBasedMarketplaceStorage.ListingStatus.Active
        );

        emit ItemListed(
            msg.sender,
            nftContract,
            tokenId,
            price,
            true,
            allowedBuyer
        );
    }

    function buyItem(
        address nftContract,
        uint256 tokenId
    ) public payable nonReentrant whenNotPaused {
        // Get the full listing directly as a struct
        IBasedMarketplaceStorage.Listing memory listing = _getListingAsStruct(
            nftContract,
            tokenId
        );

        require(listing.active, "Item not active");
        require(msg.value >= listing.price, "Insufficient funds");

        // Check if this is a private listing
        if (listing.isPrivate) {
            require(
                msg.sender == listing.allowedBuyer,
                "Not authorized for this private listing"
            );
        }

        // Ownership verification
        IERC721 nft = IERC721(listing.nftContract);
        require(
            nft.ownerOf(listing.tokenId) == listing.seller,
            "Seller no longer owns this NFT"
        );

        // Refund previous bidder if there was a bid using pull payment pattern
        _refundHighestBidder(nftContract, tokenId);

        // Update listing to sold status
        marketplaceStorage.updateListingStatus(
            nftContract,
            tokenId,
            IBasedMarketplaceStorage.ListingStatus.Sold
        );

        // Process the sale payment using our helper
        _processSaleFunds(
            listing.nftContract,
            listing.tokenId,
            listing.seller,
            msg.sender,
            listing.price
        );

        // Refund excess payment to buyer
        if (msg.value > listing.price) {
            // Add excess payment to pending withdrawals instead of immediate refund
            marketplaceStorage.addPendingWithdrawal(
                msg.sender,
                msg.value - listing.price
            );
            emit FundsAddedToWithdraw(msg.sender, msg.value - listing.price);
        }

        emit ItemSold(
            listing.seller,
            msg.sender,
            listing.nftContract,
            listing.tokenId,
            listing.price
        );
    }

    // Helper to get a full listing as a struct
    function _getListingAsStruct(
        address nftContract,
        uint256 tokenId
    ) private view returns (IBasedMarketplaceStorage.Listing memory) {
        (
            address seller,
            address nftContractAddress,
            uint256 tokenIdValue,
            uint256 price,
            bool active,
            bool isPrivate,
            address allowedBuyer,
            IBasedMarketplaceStorage.ListingStatus status
        ) = marketplaceStorage.getListing(nftContract, tokenId);

        return
            IBasedMarketplaceStorage.Listing({
                seller: seller,
                nftContract: nftContractAddress,
                tokenId: tokenIdValue,
                price: price,
                active: active,
                isPrivate: isPrivate,
                allowedBuyer: allowedBuyer,
                status: status
            });
    }

    // Helper to get a full bid as a struct
    function _getBidAsStruct(
        address nftContract,
        uint256 tokenId
    ) private view returns (IBasedMarketplaceStorage.Bid memory) {
        (address bidder, uint256 amount, uint256 timestamp) = marketplaceStorage
            .getHighestBid(nftContract, tokenId);

        return
            IBasedMarketplaceStorage.Bid({
                bidder: bidder,
                amount: amount,
                timestamp: timestamp
            });
    }

    function cancelListing(
        address nftContract,
        uint256 tokenId
    ) public nonReentrant {
        // Get listing struct
        IBasedMarketplaceStorage.Listing memory listing = _getListingAsStruct(
            nftContract,
            tokenId
        );

        require(listing.seller == msg.sender, "Not the seller");
        require(listing.active, "Listing not active");

        // Refund highest bidder if there is one using pull payment pattern
        _refundHighestBidder(nftContract, tokenId);

        // Update listing to canceled status
        marketplaceStorage.updateListingStatus(
            nftContract,
            tokenId,
            IBasedMarketplaceStorage.ListingStatus.Canceled
        );

        emit ItemCanceled(msg.sender, nftContract, tokenId);
    }

    // New function to place a bid on a listed item
    function placeBid(
        address nftContract,
        uint256 tokenId
    ) public payable nonReentrant whenNotPaused {
        // Get listing struct
        IBasedMarketplaceStorage.Listing memory listing = _getListingAsStruct(
            nftContract,
            tokenId
        );

        require(listing.active, "Item not active");
        require(listing.seller != msg.sender, "Cannot bid on your own item");
        require(msg.value > 0, "Bid must be greater than zero");
        require(
            msg.value < listing.price,
            "Bid must be less than buy now price"
        );

        // Check if this is a private listing
        if (listing.isPrivate) {
            require(
                msg.sender == listing.allowedBuyer,
                "Not authorized for this private listing"
            );
        }

        // Verify the NFT is still owned by the seller
        IERC721 nft = IERC721(listing.nftContract);
        require(
            nft.ownerOf(listing.tokenId) == listing.seller,
            "Seller no longer owns this NFT"
        );

        // Get current bid
        IBasedMarketplaceStorage.Bid memory currentBid = _getBidAsStruct(
            nftContract,
            tokenId
        );

        require(
            msg.value > currentBid.amount,
            "Bid must be higher than current bid"
        );

        // Refund the previous highest bidder using pull payment pattern
        if (currentBid.amount > 0) {
            // Add to pending withdrawals
            marketplaceStorage.addPendingWithdrawal(
                currentBid.bidder,
                currentBid.amount
            );

            emit FundsAddedToWithdraw(currentBid.bidder, currentBid.amount);
            emit BidWithdrawn(
                currentBid.bidder,
                nftContract,
                tokenId,
                currentBid.amount
            );
        }

        // Store the new bid
        marketplaceStorage.setHighestBid(
            nftContract,
            tokenId,
            msg.sender,
            msg.value,
            block.timestamp
        );

        emit BidPlaced(msg.sender, nftContract, tokenId, msg.value);
    }

    // Helper function to process funds for a sale
    function _processSaleFunds(
        address nftContract,
        uint256 tokenId,
        address seller,
        address buyer,
        uint256 amount
    ) private {
        // Calculate fees
        uint256 marketFeeAmount = (amount * marketplaceStorage.marketFee()) /
            10000;
        uint256 sellerAmount = amount - marketFeeAmount;

        // Calculate royalty
        (address royaltyReceiver, uint256 royaltyAmount) = _getRoyaltyInfo(
            nftContract,
            tokenId,
            amount
        );

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            sellerAmount -= royaltyAmount;
        }

        // Transfer NFT to buyer
        IERC721(nftContract).safeTransferFrom(seller, buyer, tokenId);

        // Add seller funds to pending withdrawals using pull payment pattern
        marketplaceStorage.addPendingWithdrawal(seller, sellerAmount);
        emit FundsAddedToWithdraw(seller, sellerAmount);

        // Handle royalty using pull payment pattern
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            marketplaceStorage.addPendingWithdrawal(
                royaltyReceiver,
                royaltyAmount
            );
            emit FundsAddedToWithdraw(royaltyReceiver, royaltyAmount);
        }

        // Update accumulated market fees
        marketplaceStorage.addAccumulatedFees(marketFeeAmount);
    }

    // Function to withdraw accumulated marketplace fees
    function withdrawAccumulatedFees() external onlyOwner nonReentrant {
        uint256 amount = marketplaceStorage.accumulatedFees();
        require(amount > 0, "No fees accumulated");

        // Reset accumulated fees to 0 before transfer to prevent reentrancy
        marketplaceStorage.resetAccumulatedFees();

        // Direct transfer to owner
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(owner(), amount);
    }

    // Allow a bidder to withdraw their bid
    function withdrawBid(
        address nftContract,
        uint256 tokenId
    ) public nonReentrant {
        // Get bid struct
        IBasedMarketplaceStorage.Bid memory bid = _getBidAsStruct(
            nftContract,
            tokenId
        );

        require(bid.bidder == msg.sender, "Not the bidder");
        require(bid.amount > 0, "No bid to withdraw");

        // Clear the bid
        marketplaceStorage.clearHighestBid(nftContract, tokenId);

        // Add to pending withdrawals using pull payment pattern
        marketplaceStorage.addPendingWithdrawal(msg.sender, bid.amount);
        emit FundsAddedToWithdraw(msg.sender, bid.amount);

        emit BidWithdrawn(msg.sender, nftContract, tokenId, bid.amount);
    }

    // Allow users to withdraw funds from pending withdrawals
    function withdrawPendingFunds() public nonReentrant {
        uint256 amount = marketplaceStorage.pendingWithdrawals(msg.sender);
        require(amount > 0, "No funds to withdraw");

        // Reset pending withdrawal before transfer to prevent reentrancy
        marketplaceStorage.setPendingWithdrawal(msg.sender, 0);

        // Transfer the funds
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }

    // Allow receivers to claim their failed royalty payments
    function claimFailedRoyalties() public nonReentrant {
        uint256 amount = marketplaceStorage.failedRoyalties(msg.sender);
        require(amount > 0, "No failed royalties to claim");

        // Reset failed royalties before transfer to prevent reentrancy
        marketplaceStorage.setFailedRoyalty(msg.sender, 0);

        // Transfer the funds
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }

    // Allow sellers to update the price of their listing
    function updateListingPrice(
        address nftContract,
        uint256 tokenId,
        uint256 newPrice
    ) public whenNotPaused {
        // Get listing struct
        IBasedMarketplaceStorage.Listing memory listing = _getListingAsStruct(
            nftContract,
            tokenId
        );

        require(listing.seller == msg.sender, "Not the seller");
        require(listing.active, "Listing not active");
        require(newPrice > 0, "Price must be greater than zero");

        // Get current bid
        IBasedMarketplaceStorage.Bid memory currentBid = _getBidAsStruct(
            nftContract,
            tokenId
        );

        if (currentBid.amount > 0) {
            require(
                newPrice > currentBid.amount,
                "New price must be higher than current bid"
            );
        }

        // Update listing price
        marketplaceStorage.updateListingPrice(nftContract, tokenId, newPrice);

        emit UpdatedListing(msg.sender, nftContract, tokenId, newPrice);
    }

    // Helper function to refund the highest bidder using pull payment pattern
    function _refundHighestBidder(
        address nftContract,
        uint256 tokenId
    ) private {
        // Get bid struct
        IBasedMarketplaceStorage.Bid memory bid = _getBidAsStruct(
            nftContract,
            tokenId
        );

        if (bid.amount > 0) {
            // Clear the bid
            marketplaceStorage.clearHighestBid(nftContract, tokenId);

            // Add to pending withdrawals using pull payment pattern
            marketplaceStorage.addPendingWithdrawal(bid.bidder, bid.amount);
            emit FundsAddedToWithdraw(bid.bidder, bid.amount);

            emit BidWithdrawn(bid.bidder, nftContract, tokenId, bid.amount);
        }
    }

    // Get royalty information for an NFT
    function _getRoyaltyInfo(
        address nftContract,
        uint256 tokenId,
        uint256 salePrice
    ) internal view returns (address receiver, uint256 royaltyAmount) {
        if (marketplaceStorage.royaltiesDisabled()) {
            return (address(0), 0);
        }

        // Try ERC2981 interface first
        if (
            IERC165(nftContract).supportsInterface(type(IERC2981).interfaceId)
        ) {
            return IERC2981(nftContract).royaltyInfo(tokenId, salePrice);
        }

        return (address(0), 0);
    }

    // Allow contract owner to pause all marketplace operations in case of emergency
    function setPaused(bool _paused) public onlyOwner {
        marketplaceStorage.setPaused(_paused);
        if (_paused) {
            emit EmergencyPaused(msg.sender);
        } else {
            emit EmergencyUnpaused(msg.sender);
        }
    }

    // Toggle royalty payments
    function setRoyaltiesDisabled(bool _disabled) public onlyOwner {
        marketplaceStorage.setRoyaltiesDisabled(_disabled);
    }

    // Check if a listing is valid
    function isListingValid(
        address nftContract,
        uint256 tokenId
    ) public view returns (bool) {
        IBasedMarketplaceStorage.Listing memory listing = _getListingAsStruct(
            nftContract,
            tokenId
        );

        if (!listing.active) return false;

        try IERC721(nftContract).ownerOf(tokenId) returns (address owner) {
            return owner == listing.seller;
        } catch {
            return false;
        }
    }

    function setMarketFee(uint256 _marketFee) public onlyOwner {
        require(_marketFee <= 1000, "Fee cannot exceed 10%"); // Maximum 10% fee
        marketplaceStorage.setMarketFee(_marketFee);
        emit MarketFeeUpdated(_marketFee);
    }

    function isListed(
        address nftContract,
        uint256 tokenId
    ) public view returns (bool) {
        IBasedMarketplaceStorage.Listing memory listing = _getListingAsStruct(
            nftContract,
            tokenId
        );
        return listing.active;
    }

    function getListing(
        address nftContract,
        uint256 tokenId
    )
        public
        view
        returns (
            address seller,
            address nftContractAddress,
            uint256 tokenIdValue,
            uint256 price,
            bool active,
            bool isPrivate,
            address allowedBuyer,
            IBasedMarketplaceStorage.ListingStatus status
        )
    {
        return marketplaceStorage.getListing(nftContract, tokenId);
    }

    function getCurrentBid(
        address nftContract,
        uint256 tokenId
    ) public view returns (address bidder, uint256 amount, uint256 timestamp) {
        return marketplaceStorage.getHighestBid(nftContract, tokenId);
    }

    // Function to directly get the status of a listing
    function getListingStatus(
        address nftContract,
        uint256 tokenId
    ) public view returns (IBasedMarketplaceStorage.ListingStatus) {
        return marketplaceStorage.getListingStatus(nftContract, tokenId);
    }

    // Allow a seller to accept the highest bid
    function acceptBid(
        address nftContract,
        uint256 tokenId
    ) public nonReentrant whenNotPaused {
        // Get the full listing and bid structs
        IBasedMarketplaceStorage.Listing memory listing = _getListingAsStruct(
            nftContract,
            tokenId
        );
        IBasedMarketplaceStorage.Bid memory highestBid = _getBidAsStruct(
            nftContract,
            tokenId
        );

        require(listing.seller == msg.sender, "Not the seller");
        require(listing.active, "Listing not active");
        require(highestBid.amount > 0, "No bids to accept");

        // Verify the NFT is still owned by the seller
        IERC721 nft = IERC721(listing.nftContract);
        require(
            nft.ownerOf(listing.tokenId) == listing.seller,
            "Seller no longer owns this NFT"
        );

        // Deactivate the listing and mark as sold
        marketplaceStorage.updateListingStatus(
            nftContract,
            tokenId,
            IBasedMarketplaceStorage.ListingStatus.Sold
        );

        // Reset the bid
        marketplaceStorage.clearHighestBid(nftContract, tokenId);

        // Process payment
        _processSaleFunds(
            listing.nftContract,
            listing.tokenId,
            listing.seller,
            highestBid.bidder,
            highestBid.amount
        );

        emit BidAccepted(
            listing.seller,
            highestBid.bidder,
            listing.nftContract,
            listing.tokenId,
            highestBid.amount
        );

        emit ItemSold(
            listing.seller,
            highestBid.bidder,
            listing.nftContract,
            listing.tokenId,
            highestBid.amount
        );
    }

    // Get the current amount of accumulated fees
    function getAccumulatedFees() public view returns (uint256) {
        return marketplaceStorage.accumulatedFees();
    }

    // Check if a user has pending withdrawals
    function getPendingWithdrawal(address user) public view returns (uint256) {
        return marketplaceStorage.pendingWithdrawals(user);
    }
}
