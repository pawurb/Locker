// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockTokenA is ERC20 {
    constructor() ERC20("Mock Token A", "MTA") {
        _mint(msg.sender, 1000);
    }
}
