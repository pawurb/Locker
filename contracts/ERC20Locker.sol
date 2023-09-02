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

contract ERC20Locker {
    mapping(address => mapping(address => DepositData)) public deposits;
    address[] public depositors;
    mapping(address => bool) private isDepositor;
    mapping(address => address[]) public configuredTokens;

    struct DepositData {
        uint256 createdAt;
        uint256 lockForDays;
        int256 minExpectedPrice;
        int256 pricePrecision;
        address priceFeed;
        uint256 balance;
    }

    modifier onlyConfigured(address _account, address _token) {
        require(
            deposits[_account][_token].lockForDays != 0,
            "Token not configured!"
        );
        _;
    }

    address private constant ZERO_ADDRESS = address(0x0);
    string private constant ERRBADCONFIG = "Invalid price configuration";

    function configureDepositWithPrice(
        address _token,
        uint256 _lockForDays,
        address _priceFeed,
        int256 _minExpectedPrice,
        int256 _pricePrecision
    ) public {
        require(
            deposits[msg.sender][_token].lockForDays == 0,
            "Token already configured!"
        );
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

        if (isDepositor[msg.sender] == false) {
            depositors.push(msg.sender);
            isDepositor[msg.sender] = true;
        }

        DepositData memory newDeposit = DepositData({
            createdAt: block.timestamp,
            minExpectedPrice: _minExpectedPrice,
            pricePrecision: _pricePrecision,
            priceFeed: _priceFeed,
            balance: 0,
            lockForDays: _lockForDays
        });

        configuredTokens[msg.sender].push(_token);
        deposits[msg.sender][_token] = newDeposit;
    }

    function configureDeposit(address _token, uint256 _lockForDays) external {
        configureDepositWithPrice(_token, _lockForDays, ZERO_ADDRESS, 0, 0);
    }

    function deposit(
        address _token,
        uint256 _amount
    ) external onlyConfigured(msg.sender, _token) {
        DepositData storage depositData = deposits[msg.sender][_token];

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        depositData.balance = depositData.balance + _amount;
    }

    function canWithdraw(
        address _account,
        address _token
    ) public view onlyConfigured(_account, _token) returns (bool) {
        DepositData memory depositData = deposits[_account][_token];

        uint256 releaseAt = depositData.createdAt +
            (depositData.lockForDays * 1 days);

        if (releaseAt < block.timestamp) {
            return true;
        } else if (depositData.minExpectedPrice == 0) {
            return false;
        } else if (depositData.minExpectedPrice < getPrice(_account, _token)) {
            return true;
        } else return false;
    }

    function withdraw(
        address _token
    ) external onlyConfigured(msg.sender, _token) {
        require(canWithdraw(msg.sender, _token), "You cannot withdraw yet!");

        DepositData storage depositData = deposits[msg.sender][_token];
        uint256 tmpBalance = depositData.balance;
        depositData.balance = 0;

        IERC20(_token).transfer(msg.sender, tmpBalance);
    }

    function increaseMinExpectedPrice(
        address _token,
        int256 _newMinExpectedPrice
    ) external onlyConfigured(msg.sender, _token) {
        DepositData storage depositData = deposits[msg.sender][_token];

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
        address _token,
        uint256 _newLockForDays
    ) external onlyConfigured(msg.sender, _token) {
        DepositData storage depositData = deposits[msg.sender][_token];

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
        address _account,
        address _token
    ) public view onlyConfigured(_account, _token) returns (int256) {
        DepositData memory depositData = deposits[_account][_token];

        if (depositData.priceFeed == ZERO_ADDRESS) {
            return 0;
        }

        (, int256 price, , , ) = PriceFeedInterface(depositData.priceFeed)
            .latestRoundData();
        return price / depositData.pricePrecision;
    }

    function getDepositors() external view returns (address[] memory) {
        return depositors;
    }

    function getConfiguredTokens(
        address _account
    ) external view returns (address[] memory) {
        return configuredTokens[_account];
    }
}
