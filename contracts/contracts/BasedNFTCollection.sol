// contracts/contracts/BasedNFTCollection.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract BasedNFTCollection is ERC721, Ownable, ReentrancyGuard, Pausable {
    using Strings for uint256;

    // Collection details
    string public baseURI;
    string public contractURI;
    uint256 public mintPrice;
    uint256 public maxSupply;
    uint256 public royaltyFee; // basis points (e.g., 250 = 2.5%)
    bool public mintingEnabled;
    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public maxTokensPerWallet; // 0 means unlimited

    // Collection stats
    uint256 public totalMinted = 0;

    // Events
    event BaseURIUpdated(string newURI);
    event ContractURIUpdated(string newURI);
    event MintPriceUpdated(uint256 newPrice);
    event MintingStatusUpdated(bool enabled);
    event NFTMinted(address to, uint256 tokenId);
    event MaxTokensPerWalletUpdated(uint256 newLimit);
    event RoyaltyFeeUpdated(uint256 newFee);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initialBaseURI,
        string memory _initialContractURI,
        uint256 _mintPrice,
        uint256 _maxSupply,
        uint256 _royaltyFee,
        bool _mintingEnabled,
        address initialOwner
    ) ERC721(_name, _symbol) Ownable(initialOwner) {
        require(_maxSupply > 0, "Max supply must be greater than 0");
        require(_royaltyFee <= 1000, "Royalty fee cannot exceed 10%");

        baseURI = _initialBaseURI;
        contractURI = _initialContractURI;
        mintPrice = _mintPrice;
        maxSupply = _maxSupply;
        royaltyFee = _royaltyFee;
        mintingEnabled = _mintingEnabled;
    }

    function mint(
        address to
    ) public payable nonReentrant whenNotPaused returns (uint256) {
        require(mintingEnabled, "Minting is disabled");
        require(totalMinted < maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        require(to != address(0), "Cannot mint to zero address");

        // Check max tokens per wallet if limit is set
        if (maxTokensPerWallet > 0) {
            require(
                balanceOf(to) < maxTokensPerWallet,
                "Would exceed max tokens per wallet"
            );
        }

        uint256 tokenId = totalMinted + 1;
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
        require(totalMinted + quantity <= maxSupply, "Would exceed max supply");
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

    function setBaseURI(string memory _newBaseURI) public onlyOwner {
        baseURI = _newBaseURI;
        emit BaseURIUpdated(_newBaseURI);
    }

    function setContractURI(string memory _contractURI) public onlyOwner {
        contractURI = _contractURI;
        emit ContractURIUpdated(_contractURI);
    }

    function setMintPrice(uint256 _mintPrice) public onlyOwner {
        mintPrice = _mintPrice;
        emit MintPriceUpdated(_mintPrice);
    }

    function setMintingEnabled(bool _enabled) public onlyOwner {
        mintingEnabled = _enabled;
        emit MintingStatusUpdated(_enabled);
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
    }

    function setMaxTokensPerWallet(
        uint256 _maxTokensPerWallet
    ) public onlyOwner {
        maxTokensPerWallet = _maxTokensPerWallet;
        emit MaxTokensPerWalletUpdated(_maxTokensPerWallet);
    }

    function setRoyaltyFee(uint256 _royaltyFee) public onlyOwner {
        require(_royaltyFee <= 1000, "Royalty fee cannot exceed 10%");
        royaltyFee = _royaltyFee;
        emit RoyaltyFeeUpdated(_royaltyFee);
    }

    // Royalty info - EIP2981
    function royaltyInfo(
        uint256 _tokenId,
        uint256 _salePrice
    ) external view returns (address receiver, uint256 royaltyAmount) {
        require(_ownerOf(_tokenId) != address(0), "Token does not exist");
        uint256 amount = (_salePrice * royaltyFee) / 10000;
        return (owner(), amount);
    }

    // Base URI for computing {tokenURI}
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    // Returns the Uniform Resource Identifier (URI) for `tokenId` token.
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        string memory base = _baseURI();
        return
            bytes(base).length > 0
                ? string.concat(base, tokenId.toString())
                : "";
    }
}
