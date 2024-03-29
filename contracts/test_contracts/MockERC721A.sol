// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721A is ERC721 {
    uint256 public totalSupply = 0;

    constructor() ERC721("NFT A", "NA") {}

    function mint() public {
        _mint(msg.sender, totalSupply);
        totalSupply = totalSupply + 1;
    }

    function burn(uint256 _tokenId) public {
        _burn(_tokenId);
    }
}
