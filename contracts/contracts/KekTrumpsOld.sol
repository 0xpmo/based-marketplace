// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

/**
 * @title RareKeksNFT
 * @dev ERC1155 contract for Rare Keks NFT collection with multiple characters and rarity tiers
 * Upgradeable to support future functionality like burning and staking
 */
contract RareKeksNFT is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ERC2981
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

    // Token ID counter - using plain uint256
    uint256 private _nextTokenId;

    // Collection info
    string public name;
    string public symbol;

    // Base URI for metadata
    string private _baseTokenURI;

    // Contract URI for collection metadata
    string private _contractURI;

    // Mint price by rarity (can be updated by owner)
    mapping(Rarity => uint256) public rarityPrices;

    // Events
    event CharacterAdded(uint256 characterId, string name);
    event TokenMinted(
        address to,
        uint256 tokenId,
        uint256 characterId,
        Rarity rarity,
        uint256 amount
    );
    event BaseURIUpdated(string newBaseURI);

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
     * @param _rarityPrices Initial mint prices
     */
    function initialize(
        string memory _name,
        string memory _symbol,
        string memory baseURI,
        string memory contractURI_,
        address royaltyRecipient,
        uint96 royaltyPercentage,
        uint256[] memory _rarityPrices
    ) public initializer {
        __ERC1155_init(baseURI);
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();

        name = _name;
        symbol = _symbol;
        _baseTokenURI = baseURI;
        _contractURI = contractURI_;

        // Set default royalty using OpenZeppelin's implementation
        _setDefaultRoyalty(royaltyRecipient, royaltyPercentage);

        // Set prices for each rarity tier
        require(_rarityPrices.length == 4, "Must provide 4 rarity prices");
        rarityPrices[Rarity.Bronze] = _rarityPrices[0];
        rarityPrices[Rarity.Silver] = _rarityPrices[1];
        rarityPrices[Rarity.Gold] = _rarityPrices[2];
        rarityPrices[Rarity.Green] = _rarityPrices[3];

        // Start token IDs from 1
        _nextTokenId = 1;
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
                uint256 newTokenId = _nextTokenId;
                newCharacter.tokenId[rarity] = newTokenId;

                // Map token ID to character and rarity
                tokenToCharacter[newTokenId] = characterId;
                tokenToRarity[newTokenId] = rarity;

                _nextTokenId++;
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
    ) external payable whenNotPaused {
        uint256 rarityPrice = rarityPrices[rarity];
        require(rarityPrice > 0, "Rarity not available for minting");
        require(msg.value >= rarityPrice * amount, "Insufficient payment");

        // Find a character with available supply for this rarity
        uint256[] memory availableCharacters = getAvailableCharactersForRarity(
            rarity
        );
        require(
            availableCharacters.length > 0,
            "No characters available for this rarity"
        );

        // Randomly select a character (using a simple pseudo-random method)
        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.timestamp,
                    msg.sender,
                    to,
                    amount
                )
            )
        ) % availableCharacters.length;

        uint256 characterId = availableCharacters[randomIndex];
        Character storage character = characters[characterId];
        uint256 tokenId = character.tokenId[rarity];

        // Update minted count
        character.minted[rarity] += amount;

        // Mint tokens
        _mint(to, tokenId, amount, "");

        emit TokenMinted(to, tokenId, characterId, rarity, amount);
    }

    /**
     * @dev Get all character IDs with available supply for a specific rarity
     */
    function getAvailableCharactersForRarity(
        Rarity rarity
    ) public view returns (uint256[] memory) {
        // Count available characters
        uint256 count = 0;
        for (uint256 i = 1; i <= 10; i++) {
            // Current character range is 1-10
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
        for (uint256 i = 1; i <= 10; i++) {
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
     * @dev Mint function that only owner can call (for giveaways, etc.)
     */
    function ownerMint(
        address to,
        uint256 characterId,
        Rarity rarity,
        uint256 amount
    ) external onlyOwner {
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
     * @dev Mint batch - allows minting multiple token rarities at once
     */
    function mintBatch(
        address to,
        Rarity[] memory rarities,
        uint256[] memory amounts
    ) external payable whenNotPaused {
        require(rarities.length == amounts.length, "Array length mismatch");

        uint256 totalCost = 0;
        for (uint i = 0; i < amounts.length; i++) {
            totalCost += rarityPrices[rarities[i]] * amounts[i];
        }

        require(msg.value >= totalCost, "Insufficient payment");

        uint256[] memory tokenIds = new uint256[](rarities.length);
        uint256[] memory characterIds = new uint256[](rarities.length);

        for (uint i = 0; i < rarities.length; i++) {
            Rarity rarity = rarities[i];

            // Find a character with available supply for this rarity
            uint256[]
                memory availableCharacters = getAvailableCharactersForRarity(
                    rarity
                );
            require(
                availableCharacters.length > 0,
                "No characters available for this rarity"
            );

            // Randomly select a character
            uint256 randomIndex = uint256(
                keccak256(
                    abi.encodePacked(
                        blockhash(block.number - 1),
                        block.timestamp,
                        msg.sender,
                        to,
                        i,
                        amounts[i]
                    )
                )
            ) % availableCharacters.length;

            uint256 characterId = availableCharacters[randomIndex];
            Character storage character = characters[characterId];
            uint256 tokenId = character.tokenId[rarity];

            // Update minted count
            character.minted[rarity] += amounts[i];

            // Store token ID for batch mint
            tokenIds[i] = tokenId;
            characterIds[i] = characterId;

            emit TokenMinted(to, tokenId, characterId, rarity, amounts[i]);
        }

        // Batch mint
        _mintBatch(to, tokenIds, amounts, "");
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
     * @dev URI for token metadata, overrides ERC1155 uri function
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < _nextTokenId, "URI query for nonexistent token");

        uint256 characterId = tokenToCharacter[tokenId];
        Rarity rarity = tokenToRarity[tokenId];

        // Using OpenZeppelin's Strings library
        return
            string(
                abi.encodePacked(
                    _baseTokenURI,
                    characterId.toString(),
                    "/",
                    uint256(rarity).toString(),
                    ".json"
                )
            );
    }

    /**
     * @dev Get the contract URI for collection metadata (used by marketplaces like OpenSea)
     */
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /**
     * @dev Update the base URI for all token metadata
     */
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @dev Update the contract URI for collection metadata
     */
    function setContractURI(string memory newContractURI) external onlyOwner {
        _contractURI = newContractURI;
    }

    /**
     * @dev Update the mint price for a specific rarity
     */
    function setRarityPrice(
        Rarity rarity,
        uint256 newPrice
    ) external onlyOwner {
        rarityPrices[rarity] = newPrice;
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
        require(newPercentage <= 1000, "Royalty percentage cannot exceed 10%");
        _setDefaultRoyalty(newRecipient, newPercentage);
    }

    /**
     * @dev Withdraw contract balance with specified splits
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;

        // Split percentages as per specification
        address wallet1 = 0x44dF92D10E91fa4D7E9eAd9fF6A6224c88ae5152; // 10%
        address wallet2 = 0x7320C98A88A982D9d194FffBfdc52AD65841334D; // 75%
        address wallet3 = 0x2a0F6eb0352F39BC5A49C8BcA2652eD3e3A1Be0B; // 10%
        address wallet4 = 0xb556CC65A8678fa27818137832c82D1E387deF03; // 5%

        uint256 amount1 = (balance * 10) / 100;
        uint256 amount2 = (balance * 75) / 100;
        uint256 amount3 = (balance * 10) / 100;
        uint256 amount4 = balance - amount1 - amount2 - amount3; // Remainder to avoid rounding issues

        payable(wallet1).transfer(amount1);
        payable(wallet2).transfer(amount2);
        payable(wallet3).transfer(amount3);
        payable(wallet4).transfer(amount4);
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
    ) public view virtual override(ERC1155Upgradeable, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Function that enables future upgrades
     * Only owner can upgrade the implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
