// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./BasedSeaSequentialNFTCollection.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract BasedSeaCollectionFactory is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // Collection creation fee
    uint256 public creationFee;

    // Address that receives the fees
    address public feeRecipient;

    // Array of all created collections
    address[] public collections;

    // Mapping from collection address to creator
    mapping(address => address) public collectionCreator;

    // Events
    event CollectionCreated(
        address indexed creator,
        address collection,
        string name,
        string symbol
    );
    event CreationFeeUpdated(uint256 newFee);
    event FeeRecipientUpdated(address newRecipient);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint256 _creationFee,
        address initialOwner
    ) public initializer {
        __Ownable_init(initialOwner);

        creationFee = _creationFee;
        feeRecipient = initialOwner;
    }

    // Required for UUPS upgradeable pattern
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function createCollection(
        string memory name,
        string memory symbol,
        string memory baseURI,
        string memory unrevealedURI,
        string memory contractURI,
        uint256 mintPrice,
        uint256 maxSupply,
        uint256 maxTokensPerWallet,
        uint96 royaltyFee,
        bool mintingEnabled,
        bool startRevealed
    ) public payable returns (address) {
        require(msg.value >= creationFee, "Insufficient creation fee");

        // Create new collection
        BasedSeaSequentialNFTCollection collection = new BasedSeaSequentialNFTCollection(
            name,
            symbol,
            baseURI,
            unrevealedURI,
            contractURI,
            mintPrice,
            maxSupply,
            maxTokensPerWallet,
            royaltyFee,
            mintingEnabled,
            startRevealed,
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
