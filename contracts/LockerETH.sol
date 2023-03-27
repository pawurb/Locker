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

contract LockerETH {
    PriceFeedInterface internal priceFeed;
    mapping(address => DepositData) public deposits;
    address[] public depositors;

    struct DepositData {
        uint256 lockForDays;
        uint256 createdAt;
        int256 minExpectedPrice;
        uint256 balance;
    }

    address private constant ZERO_ADDRESS = address(0x0);
    string private constant ERRNOTCONFIGURED = "Address not configured.";
    string private constant ERRALREADYCONFIGURED =
        "Address already configured.";

    constructor(address _priceFeed) {
        priceFeed = PriceFeedInterface(_priceFeed);
    }

    modifier onlyDepositor() {
        require(deposits[msg.sender].createdAt != 0, ERRNOTCONFIGURED);
        _;
    }

    function configureDeposit(
        uint256 _lockForDays,
        int256 _minExpectedPrice
    ) external payable {
        require(deposits[msg.sender].createdAt == 0, ERRALREADYCONFIGURED);

        require(_minExpectedPrice >= 0, "Invalid minExpectedPrice value.");
        require(_lockForDays < 10000, "Too long lockup period!");

        depositors.push(msg.sender);

        DepositData memory newLock = DepositData({
            lockForDays: _lockForDays,
            createdAt: block.timestamp,
            minExpectedPrice: _minExpectedPrice,
            balance: msg.value
        });

        deposits[msg.sender] = newLock;
    }

    function deposit() external payable onlyDepositor {
        DepositData storage depositData = deposits[msg.sender];
        depositData.balance = depositData.balance + msg.value;
    }

    function canWithdraw(
        address _account
    ) public view onlyDepositor returns (bool) {
        DepositData memory depositData = deposits[_account];

        uint256 releaseAt = depositData.createdAt +
            (depositData.lockForDays * 1 days);

        if (releaseAt < block.timestamp) {
            return true;
        } else if (depositData.minExpectedPrice == 0) {
            return false;
        } else if (depositData.minExpectedPrice < getETHPrice()) {
            return true;
        } else return false;
    }

    function withdraw() external onlyDepositor {
        require(canWithdraw(msg.sender), "You cannot withdraw yet!");
        DepositData storage depositData = deposits[msg.sender];

        uint256 balance = depositData.balance;
        depositData.balance = 0;

        payable(msg.sender).transfer(balance);
    }

    function getETHPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price / 10e7;
    }

    function increaseLockForDays(
        uint256 _newLockForDays
    ) external onlyDepositor {
        require(_newLockForDays < 10000, "Too long lockup period!");

        DepositData storage depositData = deposits[msg.sender];

        require(
            depositData.lockForDays < _newLockForDays,
            "New lockForDays value invalid!"
        );
        depositData.lockForDays = _newLockForDays;
    }

    function increaseMinExpectedPrice(
        int256 _newMinExpectedPrice
    ) external onlyDepositor {
        require(deposits[msg.sender].createdAt != 0, ERRNOTCONFIGURED);

        DepositData storage depositData = deposits[msg.sender];

        require(
            depositData.minExpectedPrice != 0,
            "minExpectedPrice not configured!"
        );

        require(
            depositData.minExpectedPrice < _newMinExpectedPrice,
            "New value invalid!"
        );
        depositData.minExpectedPrice = _newMinExpectedPrice;
    }

    function getDepositors() external view returns (address[] memory) {
        return depositors;
    }
}
