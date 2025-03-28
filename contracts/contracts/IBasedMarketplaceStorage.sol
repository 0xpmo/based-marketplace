// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IBasedMarketplaceStorage
 * @dev Interface for marketplace storage functions
 */
interface IBasedMarketplaceStorage {
    // ===== TYPE DEFINITIONS =====

    /**
     * @dev Enum representing the possible states of a listing
     */
    enum ListingStatus {
        None,
        Active,
        Sold,
        Canceled
    }

    /**
     * @dev Structure representing an NFT listing
     */
    struct Listing {
        address seller; // Address of the seller
        address nftContract; // Address of the NFT contract
        uint256 tokenId; // ID of the token being sold
        uint256 price; // Price in wei
        bool isPrivate; // Whether the listing is private
        address allowedBuyer; // Address of the allowed buyer (for private listings)
        ListingStatus status; // Current status of the listing
    }

    // ===== CONFIGURATION VIEW FUNCTIONS =====

    function marketFee() external view returns (uint256);

    function paused() external view returns (bool);

    function royaltiesDisabled() external view returns (bool);

    function feeRecipient() external view returns (address);

    // ===== CONFIGURATION SETTER FUNCTIONS =====

    function setMarketFee(uint256 _marketFee) external;

    function setFeeRecipient(address _feeRecipient) external;

    function setPaused(bool _paused) external;

    function setRoyaltiesDisabled(bool _disabled) external;

    // ===== LISTING MANAGEMENT FUNCTIONS =====

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
        );

    function setListing(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 price,
        bool isPrivate,
        address allowedBuyer
    ) external;

    function updateListingStatus(
        address nftContract,
        uint256 tokenId,
        ListingStatus status
    ) external;

    function updateListingPrice(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external;

    function isListed(
        address nftContract,
        uint256 tokenId
    ) external view returns (bool);

    // ===== BID/OFFER MANAGEMENT FUNCTIONS =====

    function isOfferUsed(bytes32 offerId) external view returns (bool);

    function markOfferAsUsed(bytes32 offerId) external;

    // ===== FAILED PAYMENT FUNCTIONS =====

    function failedPayments(address recipient) external view returns (uint256);

    function addFailedPayment(address recipient, uint256 amount) external;

    function clearFailedPayment(address recipient) external;

    // ===== MARKET FEE FUNCTIONS =====

    function accumulatedFees() external view returns (uint256);

    function addAccumulatedFees(uint256 amount) external;

    function resetAccumulatedFees() external;
}
