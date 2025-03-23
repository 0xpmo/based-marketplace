// contracts/contracts/PepeNFTCollection.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PepeNFTCollection is ERC721Enumerable, ERC721URIStorage, Ownable {
    using Strings for uint256;

    // Collection details
    string public collectionURI;
    uint256 public mintPrice;
    uint256 public maxSupply;
    uint256 public royaltyFee; // basis points (e.g., 250 = 2.5%)
    bool public mintingEnabled = false;

    // Collection stats
    uint256 public totalMinted = 0;

    // Events
    event CollectionURIUpdated(string newURI);
    event MintPriceUpdated(uint256 newPrice);
    event MintingStatusUpdated(bool enabled);
    event NFTMinted(address to, uint256 tokenId, string tokenURI);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _collectionURI,
        uint256 _mintPrice,
        uint256 _maxSupply,
        uint256 _royaltyFee,
        address initialOwner
    ) ERC721(_name, _symbol) Ownable(initialOwner) {
        collectionURI = _collectionURI;
        mintPrice = _mintPrice;
        maxSupply = _maxSupply;
        royaltyFee = _royaltyFee;
    }

    function mint(
        address to,
        string memory _tokenURI
    ) public payable returns (uint256) {
        require(mintingEnabled, "Minting is disabled");
        require(totalMinted < maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");

        uint256 tokenId = totalMinted + 1;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        totalMinted++;

        emit NFTMinted(to, tokenId, _tokenURI);

        return tokenId;
    }

    function setCollectionURI(string memory _collectionURI) public onlyOwner {
        collectionURI = _collectionURI;
        emit CollectionURIUpdated(_collectionURI);
    }

    function setMintPrice(uint256 _mintPrice) public onlyOwner {
        mintPrice = _mintPrice;
        emit MintPriceUpdated(_mintPrice);
    }

    function setMintingEnabled(bool _enabled) public onlyOwner {
        mintingEnabled = _enabled;
        emit MintingStatusUpdated(_enabled);
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // Overrides required by Solidity for multiple inheritance
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
