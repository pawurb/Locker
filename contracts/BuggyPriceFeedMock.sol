// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./PriceFeedInterface.sol";

contract BuggyPriceFeedMock is PriceFeedInterface {
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        revert("Random bug!");
        return (123, 123, 123, 123, 123);
    }
}
