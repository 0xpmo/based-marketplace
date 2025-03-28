// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IBasedMarketplaceStorage
 * @dev Combined interface for marketplace types and storage functions
 */
interface IBasedMarketplaceStorage {
    // ===== Type Definitions =====

    // Listing status enum
    enum ListingStatus {
        None,
        Active,
        Sold,
        Canceled
    }

    // Listing structure type definition
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
        bool isPrivate;
        address allowedBuyer;
        ListingStatus status;
    }

    // Bid structure type definition
    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }

    // ===== State Query Functions =====

    function marketFee() external view returns (uint256);

    function accumulatedFees() external view returns (uint256);

    function paused() external view returns (bool);

    function royaltiesDisabled() external view returns (bool);

    function pendingWithdrawals(address user) external view returns (uint256);

    function failedRoyalties(address user) external view returns (uint256);

    // ===== Listing Functions =====

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
            bool active,
            bool isPrivate,
            address allowedBuyer,
            ListingStatus status
        );

    function setListing(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 price,
        bool active,
        bool isPrivate,
        address allowedBuyer
    ) external;

    function updateListingActive(
        address nftContract,
        uint256 tokenId,
        bool active
    ) external;

    function updateListingStatus(
        address nftContract,
        uint256 tokenId,
        ListingStatus status
    ) external;

    function getListingStatus(
        address nftContract,
        uint256 tokenId
    ) external view returns (ListingStatus);

    function updateListingPrice(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external;

    // ===== Bid Functions =====

    function getHighestBid(
        address nftContract,
        uint256 tokenId
    ) external view returns (address bidder, uint256 amount, uint256 timestamp);

    function setHighestBid(
        address nftContract,
        uint256 tokenId,
        address bidder,
        uint256 amount,
        uint256 timestamp
    ) external;

    function clearHighestBid(address nftContract, uint256 tokenId) external;

    // ===== Fund Management Functions =====

    function addPendingWithdrawal(address recipient, uint256 amount) external;

    function setPendingWithdrawal(address recipient, uint256 amount) external;

    function addFailedRoyalty(address recipient, uint256 amount) external;

    function setFailedRoyalty(address recipient, uint256 amount) external;

    function addAccumulatedFees(uint256 amount) external;

    function resetAccumulatedFees() external;

    // ===== Settings Functions =====

    function setMarketFee(uint256 _marketFee) external;

    function setPaused(bool _paused) external;

    function setRoyaltiesDisabled(bool _disabled) external;
}
