// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BasedSequentialNFTCollection
 * @dev NFT Collection with sequential minting (tokens minted in order 1, 2, 3, etc.)
 */
contract BasedSequentialNFTCollection is
    ERC721Enumerable,
    ERC2981,
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using Strings for uint256;

    // Collection details
    string public baseURI;
    string public unrevealedURI;
    string public contractURI;
    uint256 public mintPrice;
    uint256 public immutable MAX_SUPPLY;
    bool public mintingEnabled;
    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public maxTokensPerWallet; // 0 means unlimited

    // Reveal settings
    bool public revealed;

    // Collection stats
    uint256 public totalMinted = 0;

    // Events
    event BaseURIUpdated(string newURI);
    event UnrevealedURIUpdated(string newURI);
    event ContractURIUpdated(string newURI);
    event MintingStatusUpdated(bool enabled);
    event NFTMinted(address to, uint256 tokenId);
    event MaxTokensPerWalletUpdated(uint256 newLimit);
    event MintPriceUpdated(uint256 newPrice);
    event WithdrawExecuted(address to, uint256 amount);
    event CollectionRevealed(bool revealed);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initialBaseURI,
        string memory _initialUnrevealedURI,
        string memory _initialContractURI,
        uint256 _mintPrice,
        uint256 _maxSupply,
        uint96 _royaltyFee,
        bool _mintingEnabled,
        bool _startRevealed,
        address initialOwner
    ) ERC721(_name, _symbol) Ownable(initialOwner) {
        require(_maxSupply > 0, "Max supply must be greater than 0");
        require(_royaltyFee <= 1000, "Royalty fee cannot exceed 10%");
        require(
            initialOwner != address(0),
            "Initial owner cannot be zero address"
        );

        baseURI = _initialBaseURI;
        unrevealedURI = _initialUnrevealedURI;
        contractURI = _initialContractURI;
        mintPrice = _mintPrice;
        MAX_SUPPLY = _maxSupply;
        mintingEnabled = _mintingEnabled;
        revealed = _startRevealed;

        // Set default royalty
        _setDefaultRoyalty(initialOwner, _royaltyFee);
    }

    /**
     * @dev Mint a single token with sequential ID
     * @param to Address to mint the token to
     * @return tokenId The ID of the minted token
     */
    function mint(
        address to
    ) public payable nonReentrant whenNotPaused returns (uint256) {
        require(mintingEnabled, "Minting is disabled");
        require(totalMinted < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        require(to != address(0), "Cannot mint to zero address");

        if (maxTokensPerWallet > 0) {
            require(
                balanceOf(to) < maxTokensPerWallet,
                "Would exceed max tokens per wallet"
            );
        }

        // Refund excess payment if any
        uint256 excess = msg.value - mintPrice;
        if (excess > 0) {
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            require(success, "Refund failed");
        }

        // Sequential minting - tokens are minted in order from 1 to MAX_SUPPLY
        uint256 tokenId = totalMinted + 1;

        _safeMint(to, tokenId);
        totalMinted++;

        emit NFTMinted(to, tokenId);
        return tokenId;
    }

    /**
     * @dev Mint multiple tokens with sequential IDs (owner only)
     * @param to Address to mint the token to
     * @param quantity Number of tokens to mint
     * @return tokenIds Array of minted token IDs
     */
    function ownerMint(
        address to,
        uint256 quantity
    ) public onlyOwner nonReentrant returns (uint256[] memory) {
        require(quantity > 0, "Quantity must be greater than 0");
        require(quantity <= MAX_BATCH_SIZE, "Exceeds maximum batch size");
        require(
            totalMinted + quantity <= MAX_SUPPLY,
            "Would exceed max supply"
        );
        require(to != address(0), "Cannot mint to zero address");

        uint256[] memory tokenIds = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = totalMinted + 1;
            _safeMint(to, tokenId);
            tokenIds[i] = tokenId;
            totalMinted++;

            emit NFTMinted(to, tokenId);
        }

        return tokenIds;
    }

    // Reveal functions
    function setRevealed(bool _revealed) public onlyOwner {
        revealed = _revealed;
        emit CollectionRevealed(_revealed);
    }

    function setUnrevealedURI(string memory _unrevealedURI) public onlyOwner {
        unrevealedURI = _unrevealedURI;
        emit UnrevealedURIUpdated(_unrevealedURI);
    }

    function setBaseURI(string memory _newBaseURI) public onlyOwner {
        baseURI = _newBaseURI;
        emit BaseURIUpdated(_newBaseURI);
    }

    function setContractURI(string memory _contractURI) public onlyOwner {
        contractURI = _contractURI;
        emit ContractURIUpdated(_contractURI);
    }

    function setMintingEnabled(bool _enabled) public onlyOwner {
        mintingEnabled = _enabled;
        emit MintingStatusUpdated(_enabled);
    }

    function setMaxTokensPerWallet(
        uint256 _maxTokensPerWallet
    ) public onlyOwner {
        maxTokensPerWallet = _maxTokensPerWallet;
        emit MaxTokensPerWalletUpdated(_maxTokensPerWallet);
    }

    function setMintPrice(uint256 _mintPrice) public onlyOwner {
        mintPrice = _mintPrice;
        emit MintPriceUpdated(_mintPrice);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function withdraw() public onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");

        emit WithdrawExecuted(owner(), balance);
    }

    // Royalty info - EIP2981
    function royaltyInfo(
        uint256 _tokenId,
        uint256 _salePrice
    ) external view override returns (address receiver, uint256 royaltyAmount) {
        return super.royaltyInfo(_tokenId, _salePrice);
    }

    // Base URI for computing {tokenURI}
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    // Returns the Uniform Resource Identifier (URI) for `tokenId` token.
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");

        if (!revealed) {
            return unrevealedURI;
        }

        string memory base = _baseURI();
        return
            bytes(base).length > 0
                ? string.concat(base, tokenId.toString())
                : "";
    }

    // Override required function
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override(ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Enumerable, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setRoyaltyInfo(
        address receiver,
        uint96 feeNumerator
    ) public onlyOwner {
        require(receiver != address(0), "Receiver cannot be zero address");
        require(feeNumerator <= 1000, "Royalty fee cannot exceed 10%");

        _setDefaultRoyalty(receiver, feeNumerator);
    }
}
