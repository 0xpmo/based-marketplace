// contracts/contracts/BasedCollectionFactory.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import "hardhat/console.sol";

import "./BasedNFTCollection.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BasedCollectionFactory is Ownable {
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

    constructor(
        uint256 _creationFee,
        address initialOwner
    ) Ownable(initialOwner) {
        console.log("constructor", _creationFee, initialOwner);
        creationFee = _creationFee;
        feeRecipient = initialOwner;
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
        console.log("createCollection", msg.value, creationFee);
        require(msg.value >= creationFee, "Insufficient creation fee");

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
