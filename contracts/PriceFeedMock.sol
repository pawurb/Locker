// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface AggregatorV3Interface {

  function decimals() external view returns (uint8);
  function description() external view returns (string memory);
  function version() external view returns (uint256);

  // getRoundData and latestRoundData should both raise "No data present"
  // if they do not have data to report, instead of returning unset values
  // which could be misinterpreted as actual reported values.
  function getRoundData(uint80 _roundId)
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );
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

contract PriceFeedMock is AggregatorV3Interface {
  int256 public mockedPrice;

  constructor(int256 _mockedPrice) {
    mockedPrice = _mockedPrice;
  }

  function decimals() external pure override returns (uint8) {
    return 18;
  }

  function description() external pure override returns (string memory) {
    return "Mock description";
  }

  function version() external pure override returns (uint256) {
    return 123;
  }

  function getRoundData(uint80)
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
