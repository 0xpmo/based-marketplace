// contracts/contracts/PepeMarketplace.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PepeNFTCollection.sol";

contract PepeMarketplace is Ownable, ReentrancyGuard {
    // Market fees
    uint256 public marketFee; // basis points (e.g., 250 = 2.5%)

    // Listing structure
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    // Mappings
    mapping(address => mapping(uint256 => Listing)) public listings;

    // Events
    event ItemListed(
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
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

    constructor(
        uint256 _marketFee,
        address initialOwner
    ) Ownable(initialOwner) {
        marketFee = _marketFee;
    }

    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) public {
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );
        require(price > 0, "Price must be greater than zero");

        listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });

        emit ItemListed(msg.sender, nftContract, tokenId, price);
    }

    function buyItem(
        address nftContract,
        uint256 tokenId
    ) public payable nonReentrant {
        Listing storage listing = listings[nftContract][tokenId];
        require(listing.active, "Item not active");
        require(msg.value >= listing.price, "Insufficient funds");

        listing.active = false;

        // Calculate fees
        uint256 marketFeeAmount = (listing.price * marketFee) / 10000;
        uint256 sellerAmount = listing.price - marketFeeAmount;

        // Calculate royalty if it's our PepeNFTCollection
        uint256 royaltyAmount = 0;
        uint256 creatorAmount = 0;

        try PepeNFTCollection(nftContract).royaltyFee() returns (
            uint256 royaltyFee
        ) {
            royaltyAmount = (listing.price * royaltyFee) / 10000;
            creatorAmount = royaltyAmount;
            sellerAmount -= royaltyAmount;
        } catch {
            // Not a PepeNFTCollection, no royalty
        }

        // Transfer NFT to buyer
        IERC721(nftContract).safeTransferFrom(
            listing.seller,
            msg.sender,
            tokenId
        );

        // Transfer funds to seller
        (bool sellerTransferSuccess, ) = payable(listing.seller).call{
            value: sellerAmount
        }("");
        require(sellerTransferSuccess, "Failed to send funds to seller");

        // Transfer royalty to creator if applicable
        if (creatorAmount > 0) {
            try PepeNFTCollection(nftContract).owner() returns (
                address creator
            ) {
                (bool creatorTransferSuccess, ) = payable(creator).call{
                    value: creatorAmount
                }("");
                require(
                    creatorTransferSuccess,
                    "Failed to send royalty to creator"
                );
            } catch {
                // If we can't get creator, add to market fee
                marketFeeAmount += creatorAmount;
            }
        }

        // Refund excess payment to buyer
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = payable(msg.sender).call{
                value: msg.value - listing.price
            }("");
            require(refundSuccess, "Failed to refund excess payment");
        }

        emit ItemSold(
            listing.seller,
            msg.sender,
            nftContract,
            tokenId,
            listing.price
        );
    }

    function cancelListing(address nftContract, uint256 tokenId) public {
        Listing storage listing = listings[nftContract][tokenId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.active, "Listing not active");

        listing.active = false;

        emit ItemCanceled(msg.sender, nftContract, tokenId);
    }

    function setMarketFee(uint256 _marketFee) public onlyOwner {
        require(_marketFee <= 1000, "Fee too high"); // Max 10%
        marketFee = _marketFee;
        emit MarketFeeUpdated(_marketFee);
    }

    function isListed(
        address nftContract,
        uint256 tokenId
    ) public view returns (bool) {
        return listings[nftContract][tokenId].active;
    }

    function getListing(
        address nftContract,
        uint256 tokenId
    ) public view returns (Listing memory) {
        return listings[nftContract][tokenId];
    }
}
