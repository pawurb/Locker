# Locker - provides a way to lock and hold your ETH or ERC20 in a smart contract

**This is a BETA software that has not been audited for security. Incorrectly using these smart contracts can result in irreversible loss of your funds. USE AT YOUR OWN RISK!**

**Disclaimer: The information provided in the readme is for educational purposes only and should not be treated as investment advice.**

[Story of the project](https://pawelurbanek.com/smart-contract-development)

## ERC20Locker.sol

This smart contract allows users to deposit ERC20 tokens and lock them for a certain period of time. Optionally, you can configure a minimum USD price that will release tokens before the time has passed.

**Do not send any ERC20 tokens directly to this contract or they will be lost!!** You have to use a dedicated `deposit` method.

**Do not use this contract for storing rebasing tokens like stETH!! Stored balance is determined once when depositing the token. It means that rebased reward will get stuck in the contract forever.**

### API

Each user account can configure any number of distinct ERC20 tokens. But, you cannot configure different time/price conditions for the same ERC20 token and account. To do it you have to use a different account.

#### `configureDeposit`

```solidity
function configureDeposit(
    address _token,
    uint256 _lockForDays
)
```

This function is used to configure a deposit without a minimum expected price for a specific token. It means that token will can released only after the configured time period has passed.

**Arguments:**

* `_token`: Address of ERC20 token to be configured.
* `_lockForDays`: The number of days the tokens will be locked.

After configuring the ERC20 token release conditions you have to approve `Locker` contract to transfer it from your account. To do it you have to make the following method call:

```solidity
  ERC20(tokenAddress).approve(lockerAddress, amount);
```

If you're not sure how to do it, then better don't. You can lose your tokens by incorrectly transferring them into the `Locker` smart contract.

#### `configureDepositWithPrice`

```solidity
function configureDepositWithPrice(
    address _token,
    uint256 _lockForDays,
    address _priceFeed,
    int256 _minExpectedPrice,
    int256 _pricePrecision
)
```

This function is used to configure a deposit with a minimum expected price for a specific token.

**Arguments:**

* `_token`: Address of ERC20 token to be configured.
* `_lockForDays`: The number of days the tokens will be locked.
* `_priceFeed`: The address of the price feed smart contract.
* `_minExpectedPrice`: The minimum expected price for the token.
* `_pricePrecision`: The oracel price precision for the token. Most ChainLink oracles use `10e7`. You can use `checkPriceFeed` method to confirm price precision used by your choosen oracle.

#### `deposit`

```solidity
function configureDepositWithPrice(
    address _token,
    uint256 _amount
)
```

Transfers and locks the `_amount` of tokens to the ERC20 `_token` address into the contract. Token must be configured and correct amount approved before calling this method.

**Arguments:**

* `_token`: Address of ERC20 token to be deposited.
* `_amount`: amount of tokens to deposit.

#### `canWithdraw`

```solidity
function canWithdraw(
    address _account,
    address _token
) returns (bool)
```

Returns `true` if the specified `_account` is eligible to withdraw deposit of their ERC20 `_token` otherwise `false`. The withdrawal is allowed if the lock period is over, or if the expected price is reached.

**Arguments:**

* `_account`: Owner account of the deposit.
* `_token`: Address of ERC20 token to be withdrawn.

#### `increaseMinExpectedPrice`

```solidity
function increaseMinExpectedPrice(
  address _token,
  int256 _newMinExpectedPrice
)
```

Increases the minimum expected price for the specified ERC20 `_token` for the caller to `_newMinExpectedPrice`, if it is greater than the current minimum expected price.

**Arguments:**

* `_token`: Address of ERC20 token to be reconfigured.
* `_newMinExpectedPrice`: New value of minimum expected price that will release the token.

#### `increaseLockForDays`

```solidity
function increaseLockForDays(
  address _token,
  int256 _newLockForDays
)
```

Increases the lock period for the specified ERC20 `_token` for the caller to `_newLockForDays`, if it is greater than the current lock period.

**Arguments:**

* `_token`: Address of ERC20 token to be reconfigured.
* `_newMinExpectedPrice`: New number of days for how long the token should be locked.

#### `checkPriceFeed`

```solidity
function checkPriceFeed(
  address _feedAddress,
  int256 _precision
) returns (int256)
```

Checks the price feed at the specified `_feedAddress` and returns the latest price divided by the specified `_precision`. You should use it to verify price oracle smart contract and necessary price precision before using it in `configureDepositWithPrice` method.

**Arguments:**

* `_feedAddress`: Address of the price oracle smart contract.
* `_precision`: Number by which a raw price value should be divided.

#### `getPrice`

```solidity
function getPrice(
  address _account,
  address _token
) returns (int256)
```

Returns the latest price of the specified ERC20 `_token` for the specified `_account`. If the price feed is not set, then 0 is returned.

**Arguments:**

* `_account`: Address of the account depositing target token.
* `_token`: Address of ERC20 token for which to check the price.

#### `getDepositors`

```solidity
function getDepositors() returns address[]
```

Returns an array of addresses representing all the depositors.

#### `getConfiguredTokens`

```solidity
function getConfiguredTokens(
  address _account
) returns (address[])
```

Returns an array of ERC20 tokens that have been configured for the specified `_account`.

**Arguments:**

* `_account`: Address of the account.

#### `deposits`

```solidity
mapping(address => mapping(address => DepositData)) deposits;
```

A nested hash representing configuration of all stored tokens. You can use it to read ERC20 token configuration based on account and token address.

## ETHLocker.sol

The `ETHLocker` contract can be used to lock your Ether for a predefined period of time. Optionally, you can configure an ETH/USD price value that will release the Ether. You need to deploy the contract with the following arguments:

```node
const deposit = await ETHLocker.new(
  0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419,
  750,
  10000
)
```

### API

`constructor(address _priceFeed, uint256 _lockForDays, int256 _minimumPrice)`

* `_priceFeedAddress` - `[address]` address of the price feed oracle contract
* `_lockForDays` - `[uint256]` number of days that you want to lock your funds for (max 4000)
* `_minimumPrice` - `[int256]` minimum price (in USD) that would release the funds (setting it to 0 disables this condition)

`canWithdraw() returns (bool)` - check if funds can be withdrawn

`withdraw()` - withdraw funds to the contract maker address

You can send more Ether to the contract after it has been initialized. Only maker of the contract can withdraw the funds. Don't send ERC20 tokens to this contract because they will be stuck forever.

## ERC20LockerPriv.sol

This contract can hold ERC20 tokens but is accessible only by an account that deployed it. You can use it to store rebasing tokens like `stETH` because total token balance is released when withdrawing the deposit.

You can use the contract in the following way:

```node
const locker = await ERC20LockerPriv.new()
await locker.configureToken(
  0x0d8775f648430679a709e98d2b0cb6250d2887ef,
  750,
  0x9441D7556e7820B5ca42082cfa99487D56AcA958,
  5,
  10e7
)
```

### API

`configureToken(address _tokenAddress, uint256 _lockForDays, address _feedAddress, int256 _minExpectedPrice, int256 _pricePrecision)`

* `_tokenAddress` - `[address]` address of an ERC20 or ETH token, i.e. [`BAT`](https://etherscan.io/token/0x0d8775f648430679a709e98d2b0cb6250d2887ef) or [`ETH`](https://etherscan.io/token/0x0000000000000000000000000000000000000000)
* `_lockForDays` - `[uint256]` how many days you want to lock the token for, counted since contract creation
* `_priceFeedAddress` - `[address]` address of a ChainLink price feed contract, e.g., [ETH/USD on Mainnet](https://etherscan.io/address/0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419). Provide a [zero address](https://etherscan.io/address/0x0000000000000000000000000000000000000000) if you don't want to withdraw based on price conditions
* `_minExpectedPrice` - `[int256]` minimum price (in units corresponding to configured `_pricePrecision`) that would release the funds (setting it to 0 disables this condition)
* `_pricePrecision` - `[int256]` inversed precision of price returned by a price feed, i.e. `10e7` for dollars and `10e5` for cents

Before configuring the token you can validate the price feed address and precision using the following method:

`checkPriceFeed(address _feedAddress, int256 _precision) returns (int256)`
* `_feedAddress` -`[address]` address of a ChainLink price feed oracle
* `_precision` - `[int256] precision of returned price values, e.g., `10e7` for dollars and `10e5` for cents

You can only configure each token once. After it is configured, you can increase the expected minimum price and lock for days duration. Using the following methods:

`increaseMinExpectedPrice(address _tokenAddress, int256 _newMinExpectedPrice)`
* `_tokenAddress` - `[address]` address of a token
* `_newMinExpectedPrice` - `[int256]` new value of a minimum expected price

`increaseLockForDays(address _tokenAddress, uint256 _newLockForDays)`
* `_tokenAddress` - `[address]` address of a token
* `_newLockForDays` - `[uint256]` new number of days that you want to lock the funds for

You can check if a given token can be withdrawn by using:

`canWithdraw(address _tokenAddress) returns (bool)`
* `_tokenAddress` - `[address]` address of a token

If the above method returns `true`, you can withdraw a selected token using:

`withdraw(address _tokenAddress)`
* `_tokenAddress` - `[address]` address of a token

Tokens will be returned to the address of a contract maker.

## ETHLockerPriv.sol

ETHLockerPriv is a smart contract that allows users to lock their Ethereum (ETH) for a specific period of time. The smart contract supports two withdrawal conditions:

- The lockup period has expired.
- The current ETH price is greater than or equal to a specified minimum price.

The smart contract constructor takes in three parameters:

* `_priceFeed`: The address of an external smart contract that provides ETH price feed.
* `_lockForDays`: The number of days to lock the deposited ETH.
* `_minimumPrice`: The minimum ETH price required to withdraw.

### API

`withdraw()` - Withdraws the deposited ETH if the withdrawal conditions are met.
`canWithdraw() returns (bool)` - Checks if the withdrawal conditions are met. Returns `true` if the withdrawal conditions are met; otherwise, `false`.


## Price feeds

ETH/USD price oracles powered by [ChainLink](https://docs.chain.link/docs/get-the-latest-price/):

* [Mainnet](https://etherscan.io/address/0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419)
* [Goerli](https://goerli.etherscan.io/address/0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e)

[More price feeds](https://docs.chain.link/data-feeds/price-feeds/addresses/).

Please be aware that ChainLink price feeds are not guaranteed always to return the correct data. In case they stop responding, you'll only be able to withdraw your funds once the lock period has expired.

## Setup

```bash
asdf install
npm install
npx hardhat node
npx hardhat test
```

### Security scan

```bash
docker pull trailofbits/eth-security-toolbox
docker run -it -v ~/Locker/:/share trailofbits/eth-security-toolbox
cd /share/Locker
slither .
```

