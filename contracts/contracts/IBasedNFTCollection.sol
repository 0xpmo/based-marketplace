// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IBasedNFTCollection
 * @dev Interface for BasedNFTCollection to support royalty functionality
 */
interface IBasedNFTCollection {
    /**
     * @dev Returns the royalty fee in basis points (e.g., 250 = 2.5%)
     */
    function royaltyFee() external view returns (uint256);

    /**
     * @dev Returns the owner/creator who should receive royalties
     */
    function owner() external view returns (address);
}
