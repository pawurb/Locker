// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "./PriceFeedInterface.sol";

contract SmartHoldETH {
  address public owner = msg.sender;
  uint public depositedAt = block.timestamp;
  uint public lockForDays;
  int public minimumPrice;
  PriceFeedInterface internal priceFeed;

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
    priceFeed = PriceFeedInterface(_priceFeed);
  }

  function withdraw() external restricted {
    require(canWithdraw(), "Cannot withdraw yet!");
    payable(owner).transfer(address(this).balance);
  }

  function canWithdraw() public view restricted returns (bool) {
    bool timeCondition = (depositedAt + (lockForDays * 1 days)) < block.timestamp;
    bool priceCondition = false;

    if(timeCondition) {
      return true;
    }

    if(minimumPrice == 0) {
      priceCondition = false;
    } else {
      priceCondition = (getPrice() >= minimumPrice);
    }
    return priceCondition;
  }

  receive() external payable {}

  function getPrice() public view returns (int) {
    (, int price,,,) = priceFeed.latestRoundData();

    return price / 10e7;
  }
}
