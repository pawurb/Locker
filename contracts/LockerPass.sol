// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract LockerPass is ERC721 {
    address public owner;
    uint256 public nextId = 0;

    constructor(
        address _owner,
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) {
        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Access denied!");
        _;
    }

    function mint(address _depositor) public onlyOwner {
        _mint(_depositor, nextId);
        nextId = nextId + 1;
    }

    function burn(uint256 _tokenId) public onlyOwner {
        _burn(_tokenId);
    }
}
