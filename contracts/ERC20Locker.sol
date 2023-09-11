// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

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

contract ERC20Locker {
    mapping(uint256 => DepositData) public deposits;
    LockerPass public lockerPass;

    struct DepositData {
        address token;
        uint256 createdAt;
        uint256 lockForDays;
        int256 minExpectedPrice;
        int256 pricePrecision;
        address priceFeed;
        uint256 balance;
    }

    modifier onlyDepositOwner(address _account, uint256 _depositId) {
        require(lockerPass.ownerOf(_depositId) == _account, "Access denied");
        require(deposits[_depositId].createdAt != 0, ERRNOTCONFIGURED);
        _;
    }

    modifier onlyConfigured(uint256 _depositId) {
        require(deposits[_depositId].createdAt != 0, ERRNOTCONFIGURED);
        _;
    }

    address private constant ZERO_ADDRESS = address(0x0);
    string private constant ERRBADCONFIG = "Invalid price configuration";
    string private constant ERRNOTCONFIGURED = "Deposit not configured.";

    constructor() {
        lockerPass = new LockerPass(address(this), "ERC20LockerPass", "LOP");
    }

    function configureDepositWithPrice(
        address _token,
        uint256 _lockForDays,
        address _priceFeed,
        int256 _minExpectedPrice,
        int256 _pricePrecision
    ) public {
        require(_minExpectedPrice >= 0, "Invalid minExpectedPrice value.");
        require(_lockForDays > 0, "Invalid lockForDays value.");

        // check feed address interface
        if (_minExpectedPrice == 0) {
            require(_priceFeed == ZERO_ADDRESS, ERRBADCONFIG);
        } else {
            require(_priceFeed != ZERO_ADDRESS, ERRBADCONFIG);
            // check feed address interface
            PriceFeedInterface(_priceFeed).latestRoundData();
        }

        DepositData memory newDeposit = DepositData({
            token: _token,
            createdAt: block.timestamp,
            minExpectedPrice: _minExpectedPrice,
            pricePrecision: _pricePrecision,
            priceFeed: _priceFeed,
            balance: 0,
            lockForDays: _lockForDays
        });

        uint256 newDepositId = lockerPass.nextId();
        lockerPass.mint(msg.sender);
        deposits[newDepositId] = newDeposit;
    }

    function configureDeposit(address _token, uint256 _lockForDays) external {
        configureDepositWithPrice(_token, _lockForDays, ZERO_ADDRESS, 0, 0);
    }

    function deposit(
        address _token,
        uint256 _amount,
        uint256 _depositId
    ) external onlyDepositOwner(msg.sender, _depositId) {
        DepositData storage depositData = deposits[_depositId];

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        depositData.balance = depositData.balance + _amount;
    }

    function canWithdraw(
        uint256 _depositId
    ) public view onlyConfigured(_depositId) returns (bool) {
        DepositData memory depositData = deposits[_depositId];

        uint256 releaseAt = depositData.createdAt +
            (depositData.lockForDays * 1 days);

        if (releaseAt < block.timestamp) {
            return true;
        } else if (depositData.minExpectedPrice == 0) {
            return false;
        } else if (depositData.minExpectedPrice < getPrice(_depositId)) {
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

        IERC20(depositData.token).transfer(msg.sender, balance);
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
            "New price value invalid!"
        );

        depositData.minExpectedPrice = _newMinExpectedPrice;
    }

    function increaseLockForDays(
        uint256 _newLockForDays,
        uint256 _depositId
    ) external onlyDepositOwner(msg.sender, _depositId) {
        DepositData storage depositData = deposits[_depositId];

        require(
            depositData.lockForDays < _newLockForDays,
            "New lockForDays value invalid!"
        );

        depositData.lockForDays = _newLockForDays;
    }

    function checkPriceFeed(
        address _feedAddress,
        int256 _precision
    ) external view returns (int256) {
        (, int256 price, , , ) = PriceFeedInterface(_feedAddress)
            .latestRoundData();
        return price / _precision;
    }

    function getPrice(
        uint256 _depositId
    ) public view onlyConfigured(_depositId) returns (int256) {
        DepositData memory depositData = deposits[_depositId];

        if (depositData.priceFeed == ZERO_ADDRESS) {
            return 0;
        }

        (, int256 price, , , ) = PriceFeedInterface(depositData.priceFeed)
            .latestRoundData();
        return price / depositData.pricePrecision;
    }
}
