// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

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

pragma solidity 0.8.17;

contract ETHLockerPriv {
    address public immutable owner;
    uint256 public immutable depositedAt;
    uint256 public immutable lockForDays;
    int256 public immutable minimumPrice;
    PriceFeedInterface internal priceFeed;

    constructor(
        address _priceFeed,
        uint256 _lockForDays,
        int256 _minimumPrice
    ) payable {
        require(_lockForDays < 4000, "Too long lockup period!");
        require(_minimumPrice >= 0, "Price must not be negative!");
        owner = msg.sender;
        lockForDays = _lockForDays;
        minimumPrice = _minimumPrice;
        depositedAt = block.timestamp;
        priceFeed = PriceFeedInterface(_priceFeed);
    }

    function withdraw() external {
        require(msg.sender == owner, "Access denied!");
        require(canWithdraw(), "Cannot withdraw yet!");
        payable(owner).transfer(address(this).balance);
    }

    function canWithdraw() public view returns (bool) {
        if ((depositedAt + (lockForDays * 1 days)) < block.timestamp) {
            return true;
        } else if (minimumPrice != 0) {
            return (getPrice() >= minimumPrice);
        } else return false;
    }

    receive() external payable {}

    function getPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();

        return price / 10e7;
    }
}
