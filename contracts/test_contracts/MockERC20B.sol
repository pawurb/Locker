// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20B is ERC20 {
    constructor() ERC20("Mock ERC20 B", "MTB") {
        _mint(msg.sender, 2000);
    }
}
