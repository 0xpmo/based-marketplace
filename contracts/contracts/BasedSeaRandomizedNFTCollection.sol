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
 * @title BasedSeaRandomizedNFTCollection
 * @dev NFT Collection with randomized token ID minting
 */
contract BasedSeaRandomizedNFTCollection is
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

    // Randomization settings
    uint256[] private _availableTokens;
    bytes32 private _lastRandomnessBlockHash;
    uint256 private _randomnessCounter;

    // Collection stats
    uint256 public totalMinted = 0;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initialBaseURI,
        string memory _initialUnrevealedURI,
        string memory _initialContractURI,
        uint256 _mintPrice,
        uint256 _maxSupply,
        uint256 _maxTokensPerWallet,
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
        maxTokensPerWallet = _maxTokensPerWallet;
        mintingEnabled = _mintingEnabled;
        revealed = _startRevealed;

        // Set default royalty
        _setDefaultRoyalty(initialOwner, _royaltyFee);

        // Initialize the randomization pool
        _initializeRandomMinting();

        // Initialize randomness components
        _lastRandomnessBlockHash = blockhash(block.number - 1);
        _randomnessCounter = 0;
    }

    /**
     * @dev Initialize the randomization pool
     * Note: For large collections, consider using a lazy initialization approach
     */
    function _initializeRandomMinting() private {
        require(_availableTokens.length == 0, "Already initialized");

        for (uint256 i = 1; i <= MAX_SUPPLY; i++) {
            _availableTokens.push(i);
        }
    }

    /**
     * @dev Get a random token ID from the available pool
     * @param minter Address of the minter (used in randomization)
     * @return tokenId The random token ID
     */
    /**
     * @dev Generate a more secure pseudo-random index
     * Uses a combination of block hash, a counter, sender info, and unique salt
     * Much harder to predict or manipulate than simple block.timestamp
     */
    function _getRandomToken(address minter) private returns (uint256) {
        require(_availableTokens.length > 0, "No tokens available");

        // Update the randomness source with the current block hash if it has changed
        if (_lastRandomnessBlockHash != blockhash(block.number - 1)) {
            _lastRandomnessBlockHash = blockhash(block.number - 1);
        }

        // Increment counter to ensure uniqueness for each call
        _randomnessCounter++;

        // Create a unique salt based on call-specific data
        bytes32 uniqueSalt = keccak256(
            abi.encodePacked(
                minter,
                block.number,
                block.timestamp,
                tx.gasprice,
                tx.origin,
                gasleft(),
                address(this).balance,
                _randomnessCounter
            )
        );

        // Mix multiple sources of entropy for better randomness
        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    _lastRandomnessBlockHash, // Hard to predict future block hash
                    block.prevrandao, // Adds unpredictability
                    uniqueSalt, // Transaction-specific entropy
                    _availableTokens.length // Changes with each mint
                )
            )
        ) % _availableTokens.length;

        // Get the token at the random index
        uint256 tokenId = _availableTokens[randomIndex];

        // Replace the selected token with the last one and remove it
        _availableTokens[randomIndex] = _availableTokens[
            _availableTokens.length - 1
        ];
        _availableTokens.pop();

        return tokenId;
    }

    /**
     * @dev Mint a single token with randomized ID
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

        // Get a random token ID
        uint256 tokenId = _getRandomToken(to);

        _safeMint(to, tokenId);
        totalMinted++;

        return tokenId;
    }

    /**
     * @dev Mint multiple tokens with randomized IDs (owner only)
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
            uint256 tokenId = _getRandomToken(to);
            _safeMint(to, tokenId);
            tokenIds[i] = tokenId;
            totalMinted++;
        }

        return tokenIds;
    }

    /**
     * @dev Get the count of remaining tokens in the random pool
     * @return count The number of tokens available
     */
    function availableTokensCount() public view returns (uint256) {
        return _availableTokens.length;
    }

    // Reveal functions
    function setRevealed(bool _revealed) public onlyOwner {
        revealed = _revealed;
    }

    function setUnrevealedURI(string memory _unrevealedURI) public onlyOwner {
        unrevealedURI = _unrevealedURI;
    }

    function setBaseURI(string memory _newBaseURI) public onlyOwner {
        baseURI = _newBaseURI;
    }

    function setContractURI(string memory _contractURI) public onlyOwner {
        contractURI = _contractURI;
    }

    function setMintingEnabled(bool _enabled) public onlyOwner {
        mintingEnabled = _enabled;
    }

    function setMaxTokensPerWallet(
        uint256 _maxTokensPerWallet
    ) public onlyOwner {
        maxTokensPerWallet = _maxTokensPerWallet;
    }

    function setMintPrice(uint256 _mintPrice) public onlyOwner {
        mintPrice = _mintPrice;
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

    // Base URI for computing {tokenURI}
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    // Returns the Uniform Resource Identifier (URI) for `tokenId` token.
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        // Check if token exists
        _requireOwned(tokenId);

        if (!revealed) {
            return unrevealedURI;
        }

        string memory base = _baseURI();
        return
            bytes(base).length > 0
                ? string.concat(base, tokenId.toString())
                : "";
    }

    /**
     * @dev Override _update to check for paused state
     * This will block transfers when the contract is paused
     * Using _update instead of _beforeTokenTransfer for OpenZeppelin v5 compatibility
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721Enumerable) whenNotPaused returns (address) {
        return super._update(to, tokenId, auth);
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
