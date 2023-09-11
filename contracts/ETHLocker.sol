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

import "./LockerPass.sol";

contract ETHLocker {
    PriceFeedInterface internal priceFeed;
    mapping(uint256 => DepositData) public deposits;
    LockerPass public lockerPass;

    struct DepositData {
        uint256 lockForDays;
        uint256 createdAt;
        int256 minExpectedPrice;
        uint256 balance;
    }

    address private constant ZERO_ADDRESS = address(0x0);
    string private constant ERRNOTCONFIGURED = "Deposit not configured.";

    constructor(address _priceFeed) {
        priceFeed = PriceFeedInterface(_priceFeed);
        lockerPass = new LockerPass(address(this), "ETHLockerPass", "LOP");
    }

    modifier onlyDepositOwner(address _account, uint256 _depositId) {
        require(lockerPass.ownerOf(_depositId) == _account, "Access denied");
        require(deposits[_depositId].createdAt != 0, ERRNOTCONFIGURED);
        _;
    }

    function configureDeposit(
        uint256 _lockForDays,
        int256 _minExpectedPrice
    ) external payable {
        require(_minExpectedPrice >= 0, "Invalid minExpectedPrice value.");

        DepositData memory newDeposit = DepositData({
            lockForDays: _lockForDays,
            createdAt: block.timestamp,
            minExpectedPrice: _minExpectedPrice,
            balance: msg.value
        });

        uint256 newDepositId = lockerPass.nextId();
        lockerPass.mint(msg.sender);
        deposits[newDepositId] = newDeposit;
    }

    function deposit(
        uint256 _depositId
    ) external payable onlyDepositOwner(msg.sender, _depositId) {
        DepositData storage depositData = deposits[_depositId];
        depositData.balance = depositData.balance + msg.value;
    }

    function canWithdraw(uint256 _depositId) public view returns (bool) {
        require(deposits[_depositId].createdAt != 0, ERRNOTCONFIGURED);

        DepositData memory depositData = deposits[_depositId];

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

    function withdraw(
        uint256 _depositId
    ) external onlyDepositOwner(msg.sender, _depositId) {
        require(canWithdraw(_depositId), "You cannot withdraw yet!");

        DepositData memory depositData = deposits[_depositId];
        uint256 balance = depositData.balance;

        delete deposits[_depositId];
        lockerPass.burn(_depositId);
        payable(msg.sender).transfer(balance);
    }

    function getETHPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price / 10e7;
    }

    function increaseLockForDays(
        uint256 _newLockForDays,
        uint256 _depositId
    ) external onlyDepositOwner(msg.sender, _depositId) {
        require(_newLockForDays < 10000, "Too long lockup period!");

        DepositData storage depositData = deposits[_depositId];

        require(
            depositData.lockForDays < _newLockForDays,
            "New lockForDays value invalid!"
        );
        depositData.lockForDays = _newLockForDays;
    }

    function increaseMinExpectedPrice(
        int256 _newMinExpectedPrice,
        uint256 _depositId
    ) external onlyDepositOwner(msg.sender, _depositId) {
        DepositData storage depositData = deposits[_depositId];

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
}
