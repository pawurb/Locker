// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "./PriceFeedInterface.sol";

contract BuggyPriceFeedMock is PriceFeedInterface {
    int256 public mockedPrice;

    constructor(int256 _mockedPrice) {
        mockedPrice = _mockedPrice;
    }

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
        revert("Price oracle bug!");
        return (123, 123, 123, 123, 123);
    }
}
