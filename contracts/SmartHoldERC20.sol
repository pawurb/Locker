// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

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

pragma solidity 0.8.4;

contract SmartHoldERC20 {
    address public immutable owner = msg.sender;
    uint256 public immutable createdAt = block.timestamp;
    mapping(string => uint256) public lockForDaysDurations;
    mapping(string => int256) public minExpectedPrices;
    mapping(string => int256) public pricePrecisions;
    mapping(string => address) public priceFeeds;
    mapping(string => address) public tokenAddresses;
    string[] public tokens;

    modifier restricted() {
        require(msg.sender == owner, "Access denied!");
        _;
    }

    function configureToken(
        string memory _symbol,
        address _tokenAddress,
        uint256 _lockForDays,
        address _feedAddress,
        int256 _minExpectedPrice,
        int256 _pricePrecision
    ) external restricted {
        require(_lockForDays > 0, "Invalid lockForDays value.");
        require(_minExpectedPrice >= 0, "Invalid minExpectedPrice value.");
        require(
            lockForDaysDurations[_symbol] == 0,
            "Token already configured!"
        );

        if (
            (_feedAddress == address(0) && _minExpectedPrice != 0) ||
            (_minExpectedPrice == 0 && _feedAddress != address(0))
        ) {
            require(false, "Invalid price configuration!");
        }

        if (_feedAddress != address(0)) {
            // check feed address interface
            PriceFeedInterface(_feedAddress).latestRoundData();
        }

        tokens.push(_symbol);
        lockForDaysDurations[_symbol] = _lockForDays;
        tokenAddresses[_symbol] = _tokenAddress;
        priceFeeds[_symbol] = _feedAddress;
        minExpectedPrices[_symbol] = _minExpectedPrice;
        pricePrecisions[_symbol] = _pricePrecision;
    }

    function increaseMinExpectedPrice(
        string memory _symbol,
        int256 _newMinExpectedPrice
    ) external restricted {
        require(
            lockForDaysDurations[_symbol] != 0,
            "Token not yet configured!"
        );
        require(
            minExpectedPrices[_symbol] < _newMinExpectedPrice,
            "New price value invalid!"
        );
        minExpectedPrices[_symbol] = _newMinExpectedPrice;
    }

    function increaseLockForDays(string memory _symbol, uint256 _newLockForDays)
        external
        restricted
    {
        require(
            lockForDaysDurations[_symbol] != 0,
            "Token not yet configured!"
        );
        require(
            lockForDaysDurations[_symbol] < _newLockForDays,
            "New lockForDays value invalid!"
        );
        lockForDaysDurations[_symbol] = _newLockForDays;
    }

    function getPrice(string memory _symbol) public view returns (int256) {
        if (priceFeeds[_symbol] == address(0)) {
            return 0;
        }

        (, int256 price, , , ) = PriceFeedInterface(priceFeeds[_symbol])
        .latestRoundData();
        return price / pricePrecisions[_symbol];
    }

    function canWithdraw(string memory _symbol) public view returns (bool) {
        require(lockForDaysDurations[_symbol] != 0, "Token not yet configured");

        uint256 releaseAt = createdAt +
            (lockForDaysDurations[_symbol] * 1 days);

        if (releaseAt < block.timestamp) {
            return true;
        } else if (minExpectedPrices[_symbol] == 0) {
            return false;
        } else if (minExpectedPrices[_symbol] < getPrice(_symbol)) {
            return true;
        } else return false;
    }

    function checkPriceFeed(address _feedAddress, int256 _precision)
        public
        view
        returns (int256)
    {
        (, int256 price, , , ) = PriceFeedInterface(_feedAddress)
        .latestRoundData();
        return price / _precision;
    }

    function getConfiguredTokensCount() public view returns (uint256) {
        return tokens.length;
    }

    function withdraw(string memory _symbol) external restricted {
        require(canWithdraw(_symbol), "You cannot withdraw yet.");

        if (keccak256(bytes(_symbol)) == keccak256(bytes("ETH"))) {
            payable(owner).transfer(address(this).balance);
        } else {
            IERC20 token = IERC20(tokenAddresses[_symbol]);
            uint256 tokenBalance = token.balanceOf(address(this));
            token.transfer(owner, tokenBalance);
        }
    }

    receive() external payable {}
}
