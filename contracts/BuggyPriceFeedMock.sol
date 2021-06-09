// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface PriceFeedInterface {
  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );
}

pragma solidity 0.7.6;

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
    ) {
    revert("Random bug!");
    return (
      123,
      123,
      123,
      123,
      123
    );
  }
}
