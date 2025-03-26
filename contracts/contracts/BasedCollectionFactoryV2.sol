// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import "hardhat/console.sol";

import "./BasedNFTCollection.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title BasedCollectionFactoryV2
 * @dev This is an upgraded version of BasedCollectionFactory with additional features:
 * - Discount system for collection creation fee
 * - Ability to mark collections as verified
 */
contract BasedCollectionFactoryV2 is Initializable, OwnableUpgradeable {
    // Collection creation fee
    uint256 public creationFee;

    // Address that receives the fees
    address public feeRecipient;

    // Array of all created collections
    address[] public collections;

    // Mapping from collection address to creator
    mapping(address => address) public collectionCreator;

    // New in V2: Discounted fee for trusted creators
    mapping(address => bool) public trustedCreator;
    uint256 public discountPercentage;

    // New in V2: Verified collections
    mapping(address => bool) public verifiedCollection;

    // Events
    event CollectionCreated(
        address indexed creator,
        address collection,
        string name,
        string symbol
    );
    event CreationFeeUpdated(uint256 newFee);
    event FeeRecipientUpdated(address newRecipient);

    // New in V2: Events
    event TrustedCreatorUpdated(address creator, bool status);
    event DiscountPercentageUpdated(uint256 percentage);
    event CollectionVerified(address collection, bool status);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint256 _creationFee,
        address initialOwner
    ) public initializer {
        console.log("initializing", _creationFee, initialOwner);
        __Ownable_init(initialOwner);

        creationFee = _creationFee;
        feeRecipient = initialOwner;

        // New in V2: initialize discount to 50%
        discountPercentage = 5000; // 50.00%
    }

    /**
     * @dev Returns the creation fee for a given creator
     * @param creator The address of the creator
     * @return The fee amount in wei
     */
    function getCreationFeeForCreator(
        address creator
    ) public view returns (uint256) {
        if (trustedCreator[creator]) {
            return (creationFee * (10000 - discountPercentage)) / 10000;
        }
        return creationFee;
    }

    function createCollection(
        string memory name,
        string memory symbol,
        string memory collectionURI,
        uint256 mintPrice,
        uint256 maxSupply,
        uint256 royaltyFee,
        bool mintingEnabled
    ) public payable returns (address) {
        // Calculate fee based on creator status
        uint256 requiredFee = getCreationFeeForCreator(msg.sender);
        console.log("createCollection", msg.value, requiredFee);
        require(msg.value >= requiredFee, "Insufficient creation fee");

        // Create new collection
        BasedNFTCollection collection = new BasedNFTCollection(
            name,
            symbol,
            collectionURI,
            mintPrice,
            maxSupply,
            royaltyFee,
            mintingEnabled,
            msg.sender // Set creator as the owner
        );

        // Record collection
        address collectionAddress = address(collection);
        collections.push(collectionAddress);
        collectionCreator[collectionAddress] = msg.sender;

        // Transfer creation fee to fee recipient
        (bool success, ) = payable(feeRecipient).call{value: msg.value}("");
        require(success, "Fee transfer failed");

        emit CollectionCreated(msg.sender, collectionAddress, name, symbol);

        return collectionAddress;
    }

    /**
     * @dev Set or unset a creator as trusted to receive fee discounts
     * @param creator The address of the creator
     * @param isTrusted Whether the creator should be trusted
     */
    function setTrustedCreator(
        address creator,
        bool isTrusted
    ) public onlyOwner {
        trustedCreator[creator] = isTrusted;
        emit TrustedCreatorUpdated(creator, isTrusted);
    }

    /**
     * @dev Set the discount percentage for trusted creators (in basis points)
     * @param percentage The discount percentage (0-10000)
     */
    function setDiscountPercentage(uint256 percentage) public onlyOwner {
        require(percentage <= 10000, "Percentage cannot exceed 100%");
        discountPercentage = percentage;
        emit DiscountPercentageUpdated(percentage);
    }

    /**
     * @dev Mark a collection as verified (or unverified)
     * @param collection The address of the collection
     * @param isVerified Whether the collection should be verified
     */
    function setCollectionVerification(
        address collection,
        bool isVerified
    ) public onlyOwner {
        verifiedCollection[collection] = isVerified;
        emit CollectionVerified(collection, isVerified);
    }

    function setCreationFee(uint256 _creationFee) public onlyOwner {
        creationFee = _creationFee;
        emit CreationFeeUpdated(_creationFee);
    }

    function setFeeRecipient(address _feeRecipient) public onlyOwner {
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    function getCollections() public view returns (address[] memory) {
        return collections;
    }

    function getCollectionCount() public view returns (uint256) {
        return collections.length;
    }
}
