// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IBasedMarketplaceStorage.sol";

/**
 * @title BasedMarketplaceStorage
 * @dev This contract serves as a dedicated storage contract for the BasedMarketplace.
 * It contains all the state variables and provides getter/setter functions for the marketplace contract.
 */
contract BasedMarketplaceStorage is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IBasedMarketplaceStorage
{
    // Market fees
    uint256 public marketFee; // basis points (e.g., 250 = 2.5%)
    uint256 public accumulatedFees; // Total fees accumulated in the contract (in wei)

    // Mappings
    mapping(address => mapping(uint256 => Listing)) private listings;
    mapping(address => mapping(uint256 => Bid)) private highestBids;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => uint256) public failedRoyalties;

    // Flag for emergency pause and royalty control
    bool public paused;
    bool public royaltiesDisabled;

    // Reserved space for future storage variables
    uint256[49] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        marketFee = 450; // Default 4.5%
        accumulatedFees = 0;
        paused = false;
        royaltiesDisabled = false;
    }

    // Required for UUPS upgradeable pattern
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // Getter for a listing
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
        )
    {
        Listing storage listing = listings[nftContract][tokenId];
        return (
            listing.seller,
            listing.nftContract,
            listing.tokenId,
            listing.price,
            listing.active,
            listing.isPrivate,
            listing.allowedBuyer,
            listing.status
        );
    }

    // Setter for a listing
    function setListing(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 price,
        bool active,
        bool isPrivate,
        address allowedBuyer
    ) external onlyOwner {
        listings[nftContract][tokenId] = Listing({
            seller: seller,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: active,
            isPrivate: isPrivate,
            allowedBuyer: allowedBuyer,
            status: active ? ListingStatus.Active : ListingStatus.None
        });
    }

    // Update listing active status
    function updateListingActive(
        address nftContract,
        uint256 tokenId,
        bool active
    ) external onlyOwner {
        listings[nftContract][tokenId].active = active;
    }

    // Update listing status
    function updateListingStatus(
        address nftContract,
        uint256 tokenId,
        ListingStatus status
    ) external onlyOwner {
        listings[nftContract][tokenId].status = status;
        // If status is Sold or Canceled, also set active to false
        if (status == ListingStatus.Sold || status == ListingStatus.Canceled) {
            listings[nftContract][tokenId].active = false;
        }
    }

    // Get listing status
    function getListingStatus(
        address nftContract,
        uint256 tokenId
    ) external view returns (ListingStatus) {
        return listings[nftContract][tokenId].status;
    }

    // Update listing price
    function updateListingPrice(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external onlyOwner {
        listings[nftContract][tokenId].price = price;
    }

    // Getter for a bid
    function getHighestBid(
        address nftContract,
        uint256 tokenId
    )
        external
        view
        returns (address bidder, uint256 amount, uint256 timestamp)
    {
        Bid storage bid = highestBids[nftContract][tokenId];
        return (bid.bidder, bid.amount, bid.timestamp);
    }

    // Setter for a bid
    function setHighestBid(
        address nftContract,
        uint256 tokenId,
        address bidder,
        uint256 amount,
        uint256 timestamp
    ) external onlyOwner {
        highestBids[nftContract][tokenId] = Bid({
            bidder: bidder,
            amount: amount,
            timestamp: timestamp
        });
    }

    // Clear a bid
    function clearHighestBid(
        address nftContract,
        uint256 tokenId
    ) external onlyOwner {
        delete highestBids[nftContract][tokenId];
    }

    // Add to pending withdrawals
    function addPendingWithdrawal(
        address recipient,
        uint256 amount
    ) external onlyOwner {
        pendingWithdrawals[recipient] += amount;
    }

    // Set pending withdrawal
    function setPendingWithdrawal(
        address recipient,
        uint256 amount
    ) external onlyOwner {
        pendingWithdrawals[recipient] = amount;
    }

    // Add to failed royalties
    function addFailedRoyalty(
        address recipient,
        uint256 amount
    ) external onlyOwner {
        failedRoyalties[recipient] += amount;
    }

    // Set failed royalty
    function setFailedRoyalty(
        address recipient,
        uint256 amount
    ) external onlyOwner {
        failedRoyalties[recipient] = amount;
    }

    // Set market fee
    function setMarketFee(uint256 _marketFee) external onlyOwner {
        marketFee = _marketFee;
    }

    // Set paused status
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    // Set royalties disabled
    function setRoyaltiesDisabled(bool _disabled) external onlyOwner {
        royaltiesDisabled = _disabled;
    }

    // Add to accumulated fees
    function addAccumulatedFees(uint256 amount) external onlyOwner {
        accumulatedFees += amount;
    }

    // Reset accumulated fees (after withdrawal)
    function resetAccumulatedFees() external onlyOwner {
        accumulatedFees = 0;
    }
}
