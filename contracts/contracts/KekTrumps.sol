// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title KekTrumps
 * @dev ERC1155 contract for KekTrumps NFT collection with multiple characters and rarity tiers
 * Upgradeable to support future functionality like burning and staking
 */
contract KekTrumps is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ERC2981Upgradeable,
    ReentrancyGuardUpgradeable
{
    using Strings for uint256;

    // Enum for rarity tiers
    enum Rarity {
        Bronze,
        Silver,
        Gold,
        Green
    }

    // Struct to store character information
    struct Character {
        string name;
        uint256 characterId;
        mapping(Rarity => uint256) maxSupply;
        mapping(Rarity => uint256) minted;
        mapping(Rarity => uint256) tokenId;
        bool enabled;
    }

    // Store all characters
    mapping(uint256 => Character) public characters;

    // Maps token ID to character ID and rarity
    mapping(uint256 => uint256) public tokenToCharacter;
    mapping(uint256 => Rarity) public tokenToRarity;

    // Collection info
    string public name;
    string public symbol;

    // Base URI for metadata
    string private _baseTokenURI;

    // Contract URI for collection metadata
    string private _contractURI;

    // Mint price by rarity (can be updated by owner)
    mapping(Rarity => uint256) public rarityPrices;

    // Maximum mint amount per transaction
    mapping(Rarity => uint256) public maxMintPerTx;

    // Withdraw addresses
    address public wallet1;
    address public wallet2;
    address public wallet3;
    address public wallet4;

    // Withdraw percentages (in basis points)
    uint16 public wallet1Percentage;
    uint16 public wallet2Percentage;
    uint16 public wallet3Percentage;
    uint16 public wallet4Percentage;

    // Events
    event CharacterAdded(uint256 characterId, string name);
    event CharacterEnabled(uint256 characterId, bool enabled);
    event TokenMinted(
        address to,
        uint256 tokenId,
        uint256 characterId,
        Rarity rarity,
        uint256 amount
    );
    event BaseURIUpdated(string newBaseURI);
    event ContractURIUpdated(string newContractURI);
    event RarityPriceUpdated(Rarity rarity, uint256 newPrice);
    event MaxMintPerTxUpdated(Rarity rarity, uint256 newLimit);
    event WithdrawalSplitUpdated(
        address wallet1,
        uint16 percentage1,
        address wallet2,
        uint16 percentage2,
        address wallet3,
        uint16 percentage3,
        address wallet4,
        uint16 percentage4
    );
    event PaymentWithdrawn(address indexed wallet, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param _name Collection name
     * @param _symbol Collection symbol
     * @param baseURI Base URI for token metadata
     * @param contractURI_ Contract URI for collection metadata
     * @param royaltyRecipient Address to receive royalties
     * @param royaltyPercentage Royalty percentage (in basis points, e.g., 750 = 7.5%)
     * @param _rarityPrices Initial mint prices for each rarity tier
     * @param _withdrawalWallets Array of 4 withdrawal addresses
     * @param _withdrawalPercentages Array of 4 withdrawal percentages (in basis points)
     */
    function initialize(
        string memory _name,
        string memory _symbol,
        string memory baseURI,
        string memory contractURI_,
        address royaltyRecipient,
        uint96 royaltyPercentage,
        uint256[] memory _rarityPrices,
        address[4] memory _withdrawalWallets,
        uint16[4] memory _withdrawalPercentages
    ) public initializer {
        __ERC1155_init(baseURI);
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ERC2981_init();
        __ReentrancyGuard_init();

        name = _name;
        symbol = _symbol;
        _baseTokenURI = baseURI;
        _contractURI = contractURI_;

        // Validate withdrawal parameters
        require(
            _withdrawalWallets[0] != address(0) &&
                _withdrawalWallets[1] != address(0) &&
                _withdrawalWallets[2] != address(0) &&
                _withdrawalWallets[3] != address(0),
            "Zero address not allowed"
        );

        require(
            _withdrawalPercentages[0] +
                _withdrawalPercentages[1] +
                _withdrawalPercentages[2] +
                _withdrawalPercentages[3] ==
                10000,
            "Percentages must sum to 100%"
        );

        // Set withdrawal addresses and percentages
        wallet1 = _withdrawalWallets[0];
        wallet2 = _withdrawalWallets[1];
        wallet3 = _withdrawalWallets[2];
        wallet4 = _withdrawalWallets[3];

        wallet1Percentage = _withdrawalPercentages[0];
        wallet2Percentage = _withdrawalPercentages[1];
        wallet3Percentage = _withdrawalPercentages[2];
        wallet4Percentage = _withdrawalPercentages[3];

        emit WithdrawalSplitUpdated(
            wallet1,
            wallet1Percentage,
            wallet2,
            wallet2Percentage,
            wallet3,
            wallet3Percentage,
            wallet4,
            wallet4Percentage
        );

        // Set default royalty using OpenZeppelin's implementation
        _setDefaultRoyalty(royaltyRecipient, royaltyPercentage);

        // Set prices for each rarity tier
        require(_rarityPrices.length == 4, "Must provide 4 rarity prices");
        rarityPrices[Rarity.Bronze] = _rarityPrices[0];
        rarityPrices[Rarity.Silver] = _rarityPrices[1];
        rarityPrices[Rarity.Gold] = _rarityPrices[2];
        rarityPrices[Rarity.Green] = _rarityPrices[3];

        // Set default max mint per transaction
        maxMintPerTx[Rarity.Bronze] = 10;
        maxMintPerTx[Rarity.Silver] = 5;
        maxMintPerTx[Rarity.Gold] = 3;
        maxMintPerTx[Rarity.Green] = 1;
    }

    /**
     * @dev Add a new character to the collection
     * @param characterId ID of the character
     * @param characterName Name of the character
     * @param bronzeSupply Max supply for Bronze rarity
     * @param silverSupply Max supply for Silver rarity
     * @param goldSupply Max supply for Gold rarity
     * @param greenSupply Max supply for Green rarity
     */
    function addCharacter(
        uint256 characterId,
        string memory characterName,
        uint256 bronzeSupply,
        uint256 silverSupply,
        uint256 goldSupply,
        uint256 greenSupply
    ) external onlyOwner {
        require(characterId > 0, "Character ID must be greater than 0");
        require(
            bytes(characterName).length > 0,
            "Character name cannot be empty"
        );
        require(!characters[characterId].enabled, "Character already exists");

        Character storage newCharacter = characters[characterId];
        newCharacter.name = characterName;
        newCharacter.characterId = characterId;
        newCharacter.enabled = true;

        // Set max supply for each rarity
        newCharacter.maxSupply[Rarity.Bronze] = bronzeSupply;
        newCharacter.maxSupply[Rarity.Silver] = silverSupply;
        newCharacter.maxSupply[Rarity.Gold] = goldSupply;
        newCharacter.maxSupply[Rarity.Green] = greenSupply;

        // Assign token IDs for each rarity
        for (uint i = 0; i <= uint(Rarity.Green); i++) {
            Rarity rarity = Rarity(i);
            if (newCharacter.maxSupply[rarity] > 0) {
                // Use characterId as the tokenId
                uint256 newTokenId = characterId * 10 + uint256(rarity);
                newCharacter.tokenId[rarity] = newTokenId;

                // Map token ID to character and rarity
                tokenToCharacter[newTokenId] = characterId;
                tokenToRarity[newTokenId] = rarity;
            }
        }

        emit CharacterAdded(characterId, characterName);
    }

    /**
     * @dev Mint a random character with a specific rarity
     * @param to Address to mint to
     * @param rarity Rarity tier to mint
     * @param amount Number of tokens to mint
     */
    function mint(
        address to,
        Rarity rarity,
        uint256 amount
    ) external payable whenNotPaused nonReentrant {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(
            amount <= maxMintPerTx[rarity],
            "Exceeds max mint per transaction"
        );

        uint256 rarityPrice = rarityPrices[rarity];
        require(rarityPrice > 0, "Rarity not available for minting");
        uint256 totalPrice = rarityPrice * amount;
        require(msg.value >= totalPrice, "Insufficient payment");

        // Find all characters with available supply for this rarity
        uint256[] memory availableCharacters = getAvailableCharactersForRarity(
            rarity
        );
        require(
            availableCharacters.length > 0,
            "No characters available for this rarity"
        );

        // Calculate total available supply across all characters
        uint256 totalAvailable = 0;
        for (uint i = 0; i < availableCharacters.length; i++) {
            uint256 characterId = availableCharacters[i];
            Character storage character = characters[characterId];
            totalAvailable +=
                character.maxSupply[rarity] -
                character.minted[rarity];
        }

        // Check if we have enough supply
        require(
            totalAvailable >= amount,
            "Insufficient supply for requested amount"
        );

        // Distribute mints across available characters
        uint256 remaining = amount;
        for (uint i = 0; i < availableCharacters.length && remaining > 0; i++) {
            uint256 startIndex = uint256(
                keccak256(
                    abi.encodePacked(
                        blockhash(block.number - 1),
                        block.coinbase,
                        block.prevrandao,
                        block.timestamp,
                        msg.sender,
                        to,
                        amount,
                        i,
                        address(this).balance
                    )
                )
            ) % availableCharacters.length;

            uint256 characterId = availableCharacters[
                (startIndex + i) % availableCharacters.length
            ];
            Character storage character = characters[characterId];

            uint256 available = character.maxSupply[rarity] -
                character.minted[rarity];
            if (available > 0) {
                uint256 toMint = remaining > available ? available : remaining;
                uint256 tokenId = character.tokenId[rarity];

                // Update minted count
                character.minted[rarity] += toMint;

                // Mint tokens
                _mint(to, tokenId, toMint, "");

                emit TokenMinted(to, tokenId, characterId, rarity, toMint);

                remaining -= toMint;
            }
        }

        // Refund excess payment
        uint256 excess = msg.value - totalPrice;
        if (excess > 0) {
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @dev Get all character IDs with available supply for a specific rarity
     */
    function getAvailableCharactersForRarity(
        Rarity rarity
    ) public view returns (uint256[] memory) {
        // Count available characters
        uint256 count = 0;
        for (uint256 i = 1; i <= 70; i++) {
            if (
                characters[i].enabled &&
                characters[i].minted[rarity] < characters[i].maxSupply[rarity]
            ) {
                count++;
            }
        }

        // Build array of available character IDs
        uint256[] memory available = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= 70; i++) {
            if (
                characters[i].enabled &&
                characters[i].minted[rarity] < characters[i].maxSupply[rarity]
            ) {
                available[index] = i;
                index++;
            }
        }

        return available;
    }

    /**
     * @dev Mint function that only owner can call
     */
    function ownerMint(
        address to,
        uint256 characterId,
        Rarity rarity,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(
            characters[characterId].enabled,
            "Character not found or disabled"
        );

        Character storage character = characters[characterId];
        uint256 tokenId = character.tokenId[rarity];

        require(tokenId > 0, "Token ID not configured for this rarity");
        require(
            character.minted[rarity] + amount <= character.maxSupply[rarity],
            "Would exceed max supply"
        );

        // Update minted count
        character.minted[rarity] += amount;

        // Mint tokens
        _mint(to, tokenId, amount, "");

        emit TokenMinted(to, tokenId, characterId, rarity, amount);
    }

    /**
     * @dev Get the current mint status of a character
     */
    function getCharacterMintStatus(
        uint256 characterId,
        Rarity rarity
    ) external view returns (uint256 minted, uint256 maxSupply) {
        require(
            characters[characterId].enabled,
            "Character not found or disabled"
        );
        Character storage character = characters[characterId];

        return (character.minted[rarity], character.maxSupply[rarity]);
    }

    /**
     * @dev Get token ID for a specific character and rarity
     */
    function getTokenId(
        uint256 characterId,
        Rarity rarity
    ) external view returns (uint256) {
        require(
            characters[characterId].enabled,
            "Character not found or disabled"
        );
        return characters[characterId].tokenId[rarity];
    }

    /**
     * @dev Get character and rarity from token ID
     */
    function getTokenDetails(
        uint256 tokenId
    )
        external
        view
        returns (
            uint256 characterId,
            string memory characterName,
            Rarity rarity
        )
    {
        characterId = tokenToCharacter[tokenId];
        require(
            characters[characterId].enabled,
            "Character not found or disabled"
        );

        return (
            characterId,
            characters[characterId].name,
            tokenToRarity[tokenId]
        );
    }

    /**
     * @dev Enable or disable a character
     * @param characterId ID of the character to update
     * @param enabled New enabled status
     */
    function setCharacterEnabled(
        uint256 characterId,
        bool enabled
    ) external onlyOwner {
        require(characterId > 0, "Character ID must be greater than 0");
        require(
            characters[characterId].characterId == characterId,
            "Character does not exist"
        );
        require(
            characters[characterId].enabled != enabled,
            "Character already in desired state"
        );

        characters[characterId].enabled = enabled;

        emit CharacterEnabled(characterId, enabled);
    }

    /**
     * @dev Returns true if token exists
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return tokenToCharacter[tokenId] > 0;
    }

    /**
     * @dev Returns total supply for a token ID
     */
    function totalSupply(uint256 tokenId) external view returns (uint256) {
        uint256 characterId = tokenToCharacter[tokenId];
        if (characterId == 0) return 0;

        Rarity rarity = tokenToRarity[tokenId];
        return characters[characterId].maxSupply[rarity];
    }

    /**
     * @dev Returns current circulating supply for a token ID
     */
    function circulatingSupply(
        uint256 tokenId
    ) external view returns (uint256) {
        uint256 characterId = tokenToCharacter[tokenId];
        if (characterId == 0) return 0;

        Rarity rarity = tokenToRarity[tokenId];
        return characters[characterId].minted[rarity];
    }

    /**
     * @dev URI for token metadata, overrides ERC1155 uri function
     */
    // function uri(uint256 tokenId) public view override returns (string memory) {
    //     // Get the character ID and rarity from the token ID
    //     uint256 characterId = tokenToCharacter[tokenId];
    //     Rarity rarity = tokenToRarity[tokenId];

    //     require(characterId > 0, "URI query for nonexistent token");

    //     return
    //         string(
    //             abi.encodePacked(
    //                 _baseTokenURI,
    //                 characterId.toString(),
    //                 "/",
    //                 uint256(rarity).toString(),
    //                 ".json"
    //             )
    //         );
    // }
    function uri(uint256 tokenId) public view override returns (string memory) {
        uint256 characterId = tokenToCharacter[tokenId];
        require(characterId > 0, "URI query for nonexistent token");

        // Simply use tokenId directly in the URI
        return
            string(
                abi.encodePacked(_baseTokenURI, tokenId.toString(), ".json")
            );
    }

    /**
     * @dev Get the contract URI for collection metadata
     */
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /**
     * @dev Update the base URI for all token metadata
     */
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        require(bytes(newBaseURI).length > 0, "Base URI cannot be empty");
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @dev Update the contract URI for collection metadata
     */
    function setContractURI(string memory newContractURI) external onlyOwner {
        require(
            bytes(newContractURI).length > 0,
            "Contract URI cannot be empty"
        );
        _contractURI = newContractURI;
        emit ContractURIUpdated(newContractURI);
    }

    /**
     * @dev Update the mint price for a specific rarity
     */
    function setRarityPrice(
        Rarity rarity,
        uint256 newPrice
    ) external onlyOwner {
        rarityPrices[rarity] = newPrice;
        emit RarityPriceUpdated(rarity, newPrice);
    }

    /**
     * @dev Update all rarity prices at once
     */
    function setRarityPrices(uint256[] memory newPrices) external onlyOwner {
        require(newPrices.length == 4, "Must provide 4 rarity prices");
        rarityPrices[Rarity.Bronze] = newPrices[0];
        rarityPrices[Rarity.Silver] = newPrices[1];
        rarityPrices[Rarity.Gold] = newPrices[2];
        rarityPrices[Rarity.Green] = newPrices[3];

        emit RarityPriceUpdated(Rarity.Bronze, newPrices[0]);
        emit RarityPriceUpdated(Rarity.Silver, newPrices[1]);
        emit RarityPriceUpdated(Rarity.Gold, newPrices[2]);
        emit RarityPriceUpdated(Rarity.Green, newPrices[3]);
    }

    /**
     * @dev Set maximum number of tokens that can be minted in a single transaction
     */
    function setMaxMintPerTx(
        Rarity rarity,
        uint256 newLimit
    ) external onlyOwner {
        require(newLimit > 0, "Limit must be greater than 0");
        maxMintPerTx[rarity] = newLimit;
        emit MaxMintPerTxUpdated(rarity, newLimit);
    }

    /**
     * @dev Update royalty information
     * @param newRecipient New royalty recipient address
     * @param newPercentage New royalty percentage (in basis points)
     */
    function setRoyaltyInfo(
        address newRecipient,
        uint96 newPercentage
    ) external onlyOwner {
        require(
            newRecipient != address(0),
            "Cannot set zero address as recipient"
        );
        require(newPercentage <= 1000, "Royalty percentage cannot exceed 10%");
        _setDefaultRoyalty(newRecipient, newPercentage);
    }

    /**
     * @dev Update withdrawal split configuration
     */
    function setWithdrawalSplit(
        address[4] memory newWallets,
        uint16[4] memory newPercentages
    ) external onlyOwner {
        require(
            newWallets[0] != address(0) &&
                newWallets[1] != address(0) &&
                newWallets[2] != address(0) &&
                newWallets[3] != address(0),
            "Zero address not allowed"
        );

        require(
            newPercentages[0] +
                newPercentages[1] +
                newPercentages[2] +
                newPercentages[3] ==
                10000,
            "Percentages must sum to 100%"
        );

        wallet1 = newWallets[0];
        wallet2 = newWallets[1];
        wallet3 = newWallets[2];
        wallet4 = newWallets[3];

        wallet1Percentage = newPercentages[0];
        wallet2Percentage = newPercentages[1];
        wallet3Percentage = newPercentages[2];
        wallet4Percentage = newPercentages[3];

        emit WithdrawalSplitUpdated(
            wallet1,
            wallet1Percentage,
            wallet2,
            wallet2Percentage,
            wallet3,
            wallet3Percentage,
            wallet4,
            wallet4Percentage
        );
    }

    /**
     * @dev Withdraw contract balance with specified splits
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        // Split percentages as per configuration
        uint256 amount1 = (balance * wallet1Percentage) / 10000;
        uint256 amount2 = (balance * wallet2Percentage) / 10000;
        uint256 amount3 = (balance * wallet3Percentage) / 10000;
        uint256 amount4 = balance - amount1 - amount2 - amount3; // Remainder to avoid rounding issues

        _safeTransfer(wallet1, amount1);
        _safeTransfer(wallet2, amount2);
        _safeTransfer(wallet3, amount3);
        _safeTransfer(wallet4, amount4);
    }

    /**
     * @dev Safe transfer function with event emission
     */
    function _safeTransfer(address to, uint256 amount) private {
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Transfer failed");
        emit PaymentWithdrawn(to, amount);
    }

    /**
     * @dev Pause minting
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause minting
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Override supportsInterface to properly declare interface support
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC1155Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Function that enables future upgrades
     * Only owner can upgrade the implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev Fallback function to receive
     * This ensures the contract can receive royalty payments from marketplaces
     */
    receive() external payable {
        // Received funds will be distributed via the withdraw function
    }
}
