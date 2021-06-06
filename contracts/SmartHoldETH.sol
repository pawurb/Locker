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

contract SmartHoldETH {
  address public owner = msg.sender;
  uint public depositedAt = block.timestamp;
  uint public lockForDays;
  int public minimumPrice;
  AggregatorV3Interface internal priceFeed;

  modifier restricted() {
    require(msg.sender == owner, "Access denied!");
    _;
  }

  constructor(address _priceFeed, uint _lockForDays, int _minimumPrice) payable {
    require(_lockForDays < 4000, "Too long lockup period!");
    require(_minimumPrice >= 0, "Minimum price must not be negative!");
    owner = msg.sender;
    lockForDays = _lockForDays;
    minimumPrice = _minimumPrice;
    depositedAt = block.timestamp;
    priceFeed = AggregatorV3Interface(_priceFeed);
  }

  function withdraw() external restricted {
    require(canWithdraw(), "Cannot withdraw yet!");
    payable(owner).transfer(address(this).balance);
  }

  function canWithdraw() public view restricted returns (bool) {
    bool timeCondition = (depositedAt + (lockForDays * 86400)) < block.timestamp;
    bool priceCondition = false;

    if(minimumPrice == 0) {
      priceCondition = false;
    } else {
      priceCondition = (getPrice() >= minimumPrice);
    }
    return timeCondition || priceCondition;
  }

  receive() external payable {}

  function getPrice() public view returns (int) {
    (, int price,,,) = priceFeed.latestRoundData();

    return price / 100000000;
  }
}
