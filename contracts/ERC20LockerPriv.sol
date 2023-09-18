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

contract ERC20LockerPriv {
    address public immutable owner = msg.sender;
    mapping(address => DepositData) public deposits;
    address[] public tokenAddresses;

    struct DepositData {
        uint256 lockForDays;
        int256 minExpectedPrice;
        int256 pricePrecision;
        address priceFeed;
        uint256 createdAt;
    }

    address private constant ZERO = address(0x0);
    string private constant ERRBADCONFIG = "Invalid price configuration";
    string private constant ERRNOTCONFIGURED = "DepositData not configured";

    modifier restricted() {
        require(msg.sender == owner, "Access denied!");
        _;
    }

    modifier onlyConfigured(address _token) {
        require(
            deposits[_token].lockForDays != 0,
            "DepositData not configured!"
        );
        _;
    }

    function configureToken(
        address _token,
        uint256 _lockForDays,
        address _priceFeed,
        int256 _minExpectedPrice,
        int256 _pricePrecision
    ) external restricted {
        require(_lockForDays > 0, "Invalid lockForDays value.");
        require(_minExpectedPrice >= 0, "Invalid minExpectedPrice value.");
        require(
            deposits[_token].lockForDays == 0,
            "DepositData already configured!"
        );

        if (_minExpectedPrice == 0) {
            require(_priceFeed == ZERO, ERRBADCONFIG);
        } else {
            require(_priceFeed != ZERO, ERRBADCONFIG);
            // check feed address interface
            PriceFeedInterface(_priceFeed).latestRoundData();
        }

        tokenAddresses.push(_token);

        DepositData memory newDepositData = DepositData({
            lockForDays: _lockForDays,
            minExpectedPrice: _minExpectedPrice,
            pricePrecision: _pricePrecision,
            priceFeed: _priceFeed,
            createdAt: block.timestamp
        });

        deposits[_token] = newDepositData;
    }

    function increaseMinExpectedPrice(
        address _token,
        int256 _newMinExpectedPrice
    ) external restricted onlyConfigured(_token) {
        DepositData storage token = deposits[_token];

        require(
            token.minExpectedPrice != 0,
            "minExpectedPrice not configured!"
        );

        require(
            token.minExpectedPrice < _newMinExpectedPrice,
            "New price value invalid!"
        );

        token.minExpectedPrice = _newMinExpectedPrice;
    }

    function increaseLockForDays(
        address _token,
        uint256 _newLockForDays
    ) external restricted onlyConfigured(_token) {
        DepositData storage token = deposits[_token];
        require(
            token.lockForDays < _newLockForDays,
            "New lockForDays value invalid!"
        );
        token.lockForDays = _newLockForDays;
    }

    function getPrice(
        address _token
    ) public view onlyConfigured(_token) returns (int256) {
        DepositData storage token = deposits[_token];
        if (token.priceFeed == ZERO) {
            return 0;
        }

        (, int256 price, , , ) = PriceFeedInterface(token.priceFeed)
            .latestRoundData();
        return price / token.pricePrecision;
    }

    function canWithdraw(
        address _token
    ) public view onlyConfigured(_token) returns (bool) {
        DepositData memory token = deposits[_token];

        uint256 releaseAt = token.createdAt + (token.lockForDays * 1 days);

        if (releaseAt < block.timestamp) {
            return true;
        } else if (token.minExpectedPrice == 0) {
            return false;
        } else if (token.minExpectedPrice < getPrice(_token)) {
            return true;
        } else return false;
    }

    function checkPriceFeed(
        address _feedAddress,
        int256 _precision
    ) external view returns (int256) {
        (, int256 price, , , ) = PriceFeedInterface(_feedAddress)
            .latestRoundData();
        return price / _precision;
    }

    function getConfiguredTokens() external view returns (address[] memory) {
        return tokenAddresses;
    }

    function withdraw(address _token) external restricted {
        require(canWithdraw(_token), "You cannot withdraw yet!");

        IERC20 erc20 = IERC20(_token);
        uint256 tokenBalance = erc20.balanceOf(address(this));
        if (tokenBalance > 0) {
            bool success = erc20.transfer(owner, tokenBalance);
            require(success, "Transfer failed.");
        }
    }
}
