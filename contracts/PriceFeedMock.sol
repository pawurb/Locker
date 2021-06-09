// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "./PriceFeedInterface.sol";

contract PriceFeedMock is PriceFeedInterface {
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
    ) {
    return (
      123,
      mockedPrice,
      123,
      123,
      123
    );
  }
}
