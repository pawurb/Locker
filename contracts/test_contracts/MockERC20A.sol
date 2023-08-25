// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20A is ERC20 {
    constructor() ERC20("Mock ERC20 A", "MTA") {
        _mint(msg.sender, 1000);
    }
}
