// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IBasedMarketplaceStorage.sol";

/**
 * @title SimplifiedBasedMarketplaceStorage
 * @dev Minimized storage contract for the SimplifiedBasedMarketplace.
 */
contract SimplifiedBasedMarketplaceStorage is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IBasedMarketplaceStorage
{
    // ===== STATE VARIABLES =====

    // Market configuration
    uint256 public marketFee; // basis points (e.g., 250 = 2.5%)
    bool public paused;
    bool public royaltiesDisabled;
    address public feeRecipient;
    uint256 public accumulatedFees; // Total fees accumulated in the contract

    // Mappings for marketplace data
    mapping(address => mapping(uint256 => Listing)) private listings;
    mapping(bytes32 => bool) public usedOfferIds;
    mapping(address => uint256) public failedPayments;

    // Reserved space for future storage variables
    uint256[44] private __gap;

    // ===== EVENTS =====
    event MarketFeeUpdated(uint256 newFee);
    event FeeRecipientUpdated(address newRecipient);
    event ContractPaused(bool isPaused);
    event RoyaltiesStatusChanged(bool disabled);
    event ListingCreated(
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );
    event ListingUpdated(
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 newPrice
    );
    event ListingStatusChanged(
        address indexed nftContract,
        uint256 indexed tokenId,
        ListingStatus status
    );
    event OfferMarkedUsed(bytes32 indexed offerId);
    event FailedPaymentAdded(address indexed recipient, uint256 amount);
    event FailedPaymentCleared(address indexed recipient, uint256 amount);
    event FeesAccumulated(uint256 amount);
    event FeesReset();

    // ===== CONSTRUCTOR & INITIALIZER =====

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ===== FAILED PAYMENT FUNCTIONS =====

    /**
     * @dev Add a failed payment for a recipient
     * @param recipient Address of the recipient
     * @param amount Amount to add
     */
    function addFailedPayment(
        address recipient,
        uint256 amount
    ) external onlyOwner {
        failedPayments[recipient] += amount;
        emit FailedPaymentAdded(recipient, amount);
    }

    /**
     * @dev Clear a failed payment (after successful claim)
     * @param recipient Address of the recipient
     */
    function clearFailedPayment(address recipient) external onlyOwner {
        uint256 amount = failedPayments[recipient];
        failedPayments[recipient] = 0;
        emit FailedPaymentCleared(recipient, amount);
    }

    // ===== MARKET FEE FUNCTIONS =====

    /**
     * @dev Add to accumulated fees
     * @param amount Amount to add
     */
    function addAccumulatedFees(uint256 amount) external onlyOwner {
        accumulatedFees += amount;
        emit FeesAccumulated(amount);
    }

    /**
     * @dev Reset accumulated fees (after withdrawal)
     */
    function resetAccumulatedFees() external onlyOwner {
        accumulatedFees = 0;
        emit FeesReset();
    }

    function initialize(address _feeRecipient) public initializer {
        require(_feeRecipient != address(0), "Invalid fee recipient");

        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        marketFee = 250; // Default 2.5%
        feeRecipient = _feeRecipient;
        paused = false;
        royaltiesDisabled = false;
        accumulatedFees = 0;
    }

    // Required for UUPS upgradeable pattern
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ===== MARKETPLACE SETTINGS FUNCTIONS =====

    /**
     * @dev Set the marketplace fee (in basis points)
     * @param _marketFee New fee amount (e.g., 250 = 2.5%)
     */
    function setMarketFee(uint256 _marketFee) external onlyOwner {
        marketFee = _marketFee;
        emit MarketFeeUpdated(_marketFee);
    }

    /**
     * @dev Set the fee recipient address
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    /**
     * @dev Set the paused status of the marketplace
     * @param _paused Whether the marketplace should be paused
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit ContractPaused(_paused);
    }

    /**
     * @dev Set whether royalty payments are disabled
     * @param _disabled Whether royalties should be disabled
     */
    function setRoyaltiesDisabled(bool _disabled) external onlyOwner {
        royaltiesDisabled = _disabled;
        emit RoyaltiesStatusChanged(_disabled);
    }

    // ===== LISTING MANAGEMENT FUNCTIONS =====

    /**
     * @dev Retrieve details of a listing
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @return Full listing details
     */
    function getListing(
        address nftContract,
        uint256 tokenId
    )
        external
        view
        returns (
            address seller,
            address nftContractAddress,
            uint256 tokenIdValue,
            uint256 price,
            bool isPrivate,
            address allowedBuyer,
            ListingStatus status
        )
    {
        Listing storage listing = listings[nftContract][tokenId];
        return (
            listing.seller,
            listing.nftContract,
            listing.tokenId,
            listing.price,
            listing.isPrivate,
            listing.allowedBuyer,
            listing.status
        );
    }

    /**
     * @dev Create or update a listing
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param seller Address of the seller
     * @param price Listing price
     * @param isPrivate Whether the listing is private
     * @param allowedBuyer Address of the allowed buyer (for private listings)
     */
    function setListing(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 price,
        bool isPrivate,
        address allowedBuyer
    ) external onlyOwner {
        listings[nftContract][tokenId] = Listing({
            seller: seller,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            isPrivate: isPrivate,
            allowedBuyer: allowedBuyer,
            status: ListingStatus.Active
        });

        emit ListingCreated(nftContract, tokenId, seller, price);
    }

    /**
     * @dev Update the status of a listing
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param status New listing status
     */
    function updateListingStatus(
        address nftContract,
        uint256 tokenId,
        ListingStatus status
    ) external onlyOwner {
        listings[nftContract][tokenId].status = status;
        emit ListingStatusChanged(nftContract, tokenId, status);
    }

    /**
     * @dev Update the price of a listing
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @param price New listing price
     */
    function updateListingPrice(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external onlyOwner {
        listings[nftContract][tokenId].price = price;
        emit ListingUpdated(nftContract, tokenId, price);
    }

    /**
     * @dev Check if an offer ID has been used
     * @param offerId Offer ID to check
     * @return Whether the offer ID has been used
     */
    function isOfferUsed(bytes32 offerId) external view returns (bool) {
        return usedOfferIds[offerId];
    }

    /**
     * @dev Mark an offer ID as used
     * @param offerId Offer ID to mark
     */
    function markOfferAsUsed(bytes32 offerId) external onlyOwner {
        usedOfferIds[offerId] = true;
        emit OfferMarkedUsed(offerId);
    }

    /**
     * @dev Check if item is listed and active
     * @param nftContract Address of the NFT contract
     * @param tokenId ID of the token
     * @return Whether the item is listed and active
     */
    function isListed(
        address nftContract,
        uint256 tokenId
    ) external view returns (bool) {
        return listings[nftContract][tokenId].status == ListingStatus.Active;
    }
}
