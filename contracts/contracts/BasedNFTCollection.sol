// contracts/contracts/BasedNFTCollection.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract BasedNFTCollection is
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

    // Reveal and randomization settings
    bool public revealed;
    bool public randomizedMinting;
    mapping(uint256 => uint256) private _tokenIdMapping;
    uint256[] private _availableTokens;

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
    event RandomizationStatusUpdated(bool enabled);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initialBaseURI,
        string memory _initialUnrevealedURI,
        string memory _initialContractURI,
        uint256 _mintPrice,
        uint256 _maxSupply,
        uint256 _royaltyFee,
        bool _mintingEnabled,
        bool _startRevealed,
        bool _randomizedMinting,
        address initialOwner
    ) ERC721(_name, _symbol) Ownable(initialOwner) {
        require(_maxSupply > 0, "Max supply must be greater than 0");
        require(_royaltyFee <= 1000, "Royalty fee cannot exceed 10%");

        baseURI = _initialBaseURI;
        unrevealedURI = _initialUnrevealedURI;
        contractURI = _initialContractURI;
        mintPrice = _mintPrice;
        MAX_SUPPLY = _maxSupply;
        mintingEnabled = _mintingEnabled;
        revealed = _startRevealed;
        randomizedMinting = _randomizedMinting;

        // Set default royalty
        _setDefaultRoyalty(initialOwner, _royaltyFee);

        if (randomizedMinting) {
            _initializeRandomMinting();
        }
    }

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

        uint256 tokenId;
        if (randomizedMinting) {
            tokenId = _getRandomToken(to);
        } else {
            tokenId = totalMinted + 1;
        }

        _safeMint(to, tokenId);
        totalMinted++;

        emit NFTMinted(to, tokenId);
        return tokenId;
    }

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
            uint256 tokenId;
            if (randomizedMinting) {
                tokenId = _getRandomToken(to);
            } else {
                tokenId = totalMinted + 1;
            }
            _safeMint(to, tokenId);
            tokenIds[i] = tokenId;
            totalMinted++;

            emit NFTMinted(to, tokenId);
        }

        return tokenIds;
    }

    function _initializeRandomMinting() private {
        require(_availableTokens.length == 0, "Already initialized");
        for (uint256 i = 1; i <= MAX_SUPPLY; i++) {
            _availableTokens.push(i);
        }
    }

    function _getRandomToken(address minter) private returns (uint256) {
        require(_availableTokens.length > 0, "No tokens available");

        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    minter,
                    _availableTokens.length
                )
            )
        ) % _availableTokens.length;

        uint256 tokenId = _availableTokens[randomIndex];
        _availableTokens[randomIndex] = _availableTokens[
            _availableTokens.length - 1
        ];
        _availableTokens.pop();

        return tokenId;
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
        _setDefaultRoyalty(receiver, feeNumerator);
    }
}
