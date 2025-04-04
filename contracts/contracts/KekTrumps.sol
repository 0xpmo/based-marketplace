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
 * @dev ERC1155 contract supporting multiple characters and rarity tiers
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

    enum Rarity {
        Bronze,
        Silver,
        Gold,
        Green
    }

    struct Character {
        string name;
        uint256 characterId;
        mapping(Rarity => uint256) maxSupply;
        mapping(Rarity => uint256) minted;
        mapping(Rarity => uint256) burned;
        mapping(Rarity => uint256) tokenId;
        bool enabled;
    }

    struct CharacterInfo {
        string name;
        uint256 characterId;
        uint256[4] maxSupply;
        uint256[4] minted;
        uint256[4] burned;
        uint256[4] tokenId;
        bool enabled;
    }

    mapping(uint256 => Character) public characters;
    mapping(uint256 => uint256) public tokenToCharacter;
    mapping(uint256 => Rarity) public tokenToRarity;

    string public name;
    string public symbol;
    string private _baseTokenURI;
    string private _contractURI;

    mapping(Rarity => uint256) public rarityPrices;
    mapping(Rarity => uint256) public maxMintPerTx;

    address public wallet1;
    address public wallet2;
    address public wallet3;
    address public wallet4;

    uint16 public wallet1Percentage;
    uint16 public wallet2Percentage;
    uint16 public wallet3Percentage;
    uint16 public wallet4Percentage;

    event CharacterAdded(uint256 characterId, string name);
    event TokenMinted(
        address to,
        uint256 tokenId,
        uint256 characterId,
        Rarity rarity,
        uint256 amount
    );
    event PaymentWithdrawn(address indexed wallet, uint256 amount);
    event WithdrawalSplitUpdated(
        address wallet1,
        uint16 p1,
        address wallet2,
        uint16 p2,
        address wallet3,
        uint16 p3,
        address wallet4,
        uint16 p4
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract and configures base data.
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

        for (uint i = 0; i < 4; i++) {
            require(
                _withdrawalWallets[i] != address(0),
                "Zero addresses not allowed"
            );
        }
        require(
            _withdrawalPercentages[0] +
                _withdrawalPercentages[1] +
                _withdrawalPercentages[2] +
                _withdrawalPercentages[3] ==
                10000,
            "Percentages must sum to 100%"
        );

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

        _setDefaultRoyalty(royaltyRecipient, royaltyPercentage);

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
     * @dev Adds a new character with given rarity tier supply.
     */
    function addCharacter(
        uint256 characterId,
        string memory characterName,
        uint256 bronzeSupply,
        uint256 silverSupply,
        uint256 goldSupply,
        uint256 greenSupply
    ) external onlyOwner {
        require(!characters[characterId].enabled, "Exists");

        Character storage c = characters[characterId];
        c.name = characterName;
        c.characterId = characterId;
        c.enabled = true;

        c.maxSupply[Rarity.Bronze] = bronzeSupply;
        c.maxSupply[Rarity.Silver] = silverSupply;
        c.maxSupply[Rarity.Gold] = goldSupply;
        c.maxSupply[Rarity.Green] = greenSupply;

        for (uint i = 0; i < 4; i++) {
            Rarity r = Rarity(i);
            if (c.maxSupply[r] > 0) {
                uint256 tokenId = characterId * 10 + i;
                c.tokenId[r] = tokenId;
                tokenToCharacter[tokenId] = characterId;
                tokenToRarity[tokenId] = r;
            }
        }

        emit CharacterAdded(characterId, characterName);
    }

    /**
     * @dev Internal utility to randomly shuffle a uint256 array in place
     */
    function shuffle(
        uint256[] memory array,
        uint256 nonce
    ) internal view returns (uint256[] memory) {
        for (uint256 i = array.length - 1; i > 0; i--) {
            uint256 j = uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao,
                        block.timestamp,
                        msg.sender,
                        block.number,
                        nonce,
                        i
                    )
                )
            ) % (i + 1);
            (array[i], array[j]) = (array[j], array[i]);
        }
        return array;
    }

    function mint(
        address to,
        Rarity rarity,
        uint256 amount
    ) external payable whenNotPaused nonReentrant {
        require(to != address(0), "Zero address");
        require(amount > 0 && amount <= maxMintPerTx[rarity], "Invalid amount");

        uint256 price = rarityPrices[rarity];
        require(msg.value >= price * amount, "Insufficient payment");

        // For each token we want to mint
        for (uint256 i = 0; i < amount; i++) {
            uint256[] memory available = getAvailableCharactersForRarity(
                rarity
            );
            require(available.length > 0, "Supply exhausted during mint");
            available = shuffle(available, i); // Pass the iteration number as nonce

            Character storage c = characters[available[0]];
            require(
                c.minted[rarity] < c.maxSupply[rarity],
                "Character supply exceeded"
            );

            c.minted[rarity] += 1;
            _mint(to, c.tokenId[rarity], 1, "");
            emit TokenMinted(to, c.tokenId[rarity], c.characterId, rarity, 1);
        }

        uint256 refund = msg.value - price * amount;
        if (refund > 0) {
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @dev Allows the owner to mint specific characters with specific rarities to any address.
     * @param to Recipient address
     * @param characterId Character ID to mint
     * @param rarity Rarity tier to mint
     * @param amount Number of tokens to mint
     */
    function ownerMint(
        address to,
        uint256 characterId,
        Rarity rarity,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(to != address(0), "Zero address");
        require(amount > 0, "Invalid amount");
        require(characters[characterId].enabled, "Character not enabled");

        Character storage c = characters[characterId];
        require(
            c.minted[rarity] + amount <= c.maxSupply[rarity],
            "Would exceed max supply"
        );

        c.minted[rarity] += amount;
        _mint(to, c.tokenId[rarity], amount, "");

        emit TokenMinted(to, c.tokenId[rarity], c.characterId, rarity, amount);
    }

    /**
     * @dev Burns tokens from the sender or approved address.
     * Only the token holder or approved operator can burn.
     */
    function burn(
        address from,
        uint256 tokenId,
        uint256 amount
    ) external whenNotPaused {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "Not approved"
        );
        _burn(from, tokenId, amount);

        uint256 characterId = tokenToCharacter[tokenId];
        Rarity rarity = tokenToRarity[tokenId];
        characters[characterId].burned[rarity] += amount;
    }

    /**
     * @dev Returns character IDs that still have supply left for a given rarity.
     */
    function getAvailableCharactersForRarity(
        Rarity rarity
    ) public view returns (uint256[] memory) {
        uint256[] memory temp = new uint256[](70);
        uint256 count = 0;
        for (uint i = 1; i <= 70; i++) {
            if (
                characters[i].enabled &&
                characters[i].minted[rarity] < characters[i].maxSupply[rarity]
            ) {
                temp[count++] = i;
            }
        }
        uint256[] memory result = new uint256[](count);
        for (uint i = 0; i < count; i++) result[i] = temp[i];
        return result;
    }

    /**
     * @dev Returns all supply and status details for a given character ID.
     */
    function getCharacter(
        uint256 characterId
    ) external view returns (CharacterInfo memory) {
        require(
            characterId > 0 && characters[characterId].enabled,
            "Invalid character"
        );

        Character storage c = characters[characterId];
        uint256[4] memory maxSupply;
        uint256[4] memory minted;
        uint256[4] memory burned;
        uint256[4] memory tokenIds;

        for (uint i = 0; i < 4; i++) {
            Rarity rarity = Rarity(i);
            maxSupply[i] = c.maxSupply[rarity];
            minted[i] = c.minted[rarity];
            burned[i] = c.burned[rarity];
            tokenIds[i] = c.tokenId[rarity];
        }

        return
            CharacterInfo({
                name: c.name,
                characterId: c.characterId,
                maxSupply: maxSupply,
                minted: minted,
                burned: burned,
                tokenId: tokenIds,
                enabled: c.enabled
            });
    }

    /**
     * @dev Returns the number of currently circulating tokens for a given tokenId.
     */
    function circulatingSupply(
        uint256 tokenId
    ) external view returns (uint256) {
        uint256 cId = tokenToCharacter[tokenId];
        Rarity r = tokenToRarity[tokenId];
        Character storage c = characters[cId];
        return c.minted[r] - c.burned[r];
    }

    /**
     * @dev Returns total circulating supply across all characters and rarities.
     */
    function totalSupply() external view returns (uint256 total) {
        for (uint i = 1; i <= 70; i++) {
            Character storage c = characters[i];
            for (uint j = 0; j < 4; j++) {
                Rarity r = Rarity(j);
                total += c.minted[r] - c.burned[r];
            }
        }
    }

    /**
     * @dev Returns the full metadata URI for a given tokenId.
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenToCharacter[tokenId] > 0, "Invalid token");
        return
            string(
                abi.encodePacked(_baseTokenURI, tokenId.toString(), ".json")
            );
    }

    /**
     * @dev Returns the collection-level metadata URI.
     */
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /**
     * @dev Withdraws contract balance based on the configured wallet split.
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "Nothing to withdraw");

        uint256 a1 = (bal * wallet1Percentage) / 10000;
        uint256 a2 = (bal * wallet2Percentage) / 10000;
        uint256 a3 = (bal * wallet3Percentage) / 10000;
        uint256 a4 = bal - a1 - a2 - a3;

        _safeTransfer(wallet1, a1);
        _safeTransfer(wallet2, a2);
        _safeTransfer(wallet3, a3);
        _safeTransfer(wallet4, a4);
    }

    /**
     * @dev Updates the default royalty recipient and percentage.
     * @param recipient Address to receive royalties
     * @param feeNumerator New royalty fee numerator (denominator is 10000, so 1000 = 10%)
     */
    function updateDefaultRoyalty(
        address recipient,
        uint96 feeNumerator
    ) external onlyOwner {
        require(recipient != address(0), "Zero address");
        _setDefaultRoyalty(recipient, feeNumerator);
    }

    /**
     * @dev Updates the base URI for all token metadata.
     * @param newBaseURI New base URI for token metadata
     */
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    /**
     * @dev Updates the contract URI for collection metadata.
     * @param newContractURI New URI for collection metadata
     */
    function setContractURI(string memory newContractURI) external onlyOwner {
        _contractURI = newContractURI;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Transfer failed");
        emit PaymentWithdrawn(to, amount);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC1155Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    receive() external payable {}
}
