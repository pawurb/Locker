# Locker - provides a way to lock and hold your ETH, ERC20 or ERC721 in a smart contract

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

This function is used to configure a deposit without a minimum expected price for a specific token. It means that token will be released only after the configured time period has passed.

**Arguments:**

* `_token`: Address of ERC20 token to be configured.
* `_lockForDays`: The number of days the tokens will be locked.

As a result of executing this method a `LockerPass` NFT token will be minted to your account. As long as you're an owner of a target NFT representing your deposit you'll be able to manage and withdraw the deposited ERC20 tokens.

After configuring the ERC20 token release conditions you have to approve `Locker` contract to transfer it from your account. To do it you have to make the following method call:

```solidity
  ERC20(tokenAddress).approve(lockerAddress, amount);
```

If you're not sure how to do it, then better don't. You can lose your tokens by incorrectly transferring them into the `ERC20Locker` smart contract.

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
* `_pricePrecision`: The oracle price precision for the token. Most ChainLink oracles use `10e7`. You can use `checkPriceFeed` method to confirm price precision used by your choosen oracle.

#### `deposit`

```solidity
function deposit(
    address _token,
    uint256 _amount,
    uint256 _depositId
)
```

Transfers and locks the `_amount` of tokens to the ERC20 `_token` address into the contract. Token must be configured and correct amount approved before calling this method.

You must be owner of a `LockerPass` NFT with a target `_depositId` to execute this method.

**Arguments:**

* `_token`: Address of ERC20 token to be deposited.
* `_amount`: amount of tokens to deposit.
* `_depositId`: ID of a target deposit

#### `canWithdraw`

```solidity
function canWithdraw(
    uint256 _depositId
) returns (bool)
```

Returns `true` if the specified `_depositId` be withdrawn by an owner. The withdrawal is allowed if the lock period is over, or if the expected price is reached.

**Arguments:**

* `_depositId`: ID of a target deposit


#### `withdraw`

```solidity
function withdraw(
    uint256 _depositId
)
```

This method withdraws ERC20 tokens deposited in a target `_depositId` and burns associated `LockerPass` NFT token. It can be executed only if `canWithdraw` returns `true` for a target `_depositId`.

#### `increaseMinExpectedPrice`

```solidity
function increaseMinExpectedPrice(
  int256 _newMinExpectedPrice
  uint256 _depositId
)
```

Increases the minimum expected price for the specified `_depositId` to `_newMinExpectedPrice`, if it is greater than the current minimum expected price.

**Arguments:**

* `_newMinExpectedPrice`: New value of minimum expected price that will release the token.
* `_depositId`: ID of a target deposit

#### `increaseLockForDays`

```solidity
function increaseLockForDays(
  int256 _newLockForDays
  uint256 _depositId
)
```

Increases the lock period for the specified `_depositId` to `_newLockForDays`, if it is greater than the current lock period.

**Arguments:**

* `_newMinExpectedPrice`: New number of days for how long the token should be locked.
* `_depositId`: ID of a target deposit

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
  uint256 _depositId
) returns (int256)
```

Returns the latest price reported for a configured `_depositId`. If the price feed is not set, then 0 is returned.

**Arguments:**

* `_depositId`: ID of a target deposit

#### `deposits`

```solidity
mapping(uint256 => DepositData) deposits;
```

A nested hash representing configuration of all configured deposits. You can use it to read ERC20 token configuration based on a `_depositId`.

## ETHLocker.sol

The `ETHLocker` contract can be used to lock your Ether for a predefined period of time. Optionally, you can configure an ETH/USD price value that will release the Ether. You need to deploy the contract with the following arguments:

```node
const locker = await ETHLocker.new(
  0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
)
```

### API

#### `configureDeposit`

```solidity
function configureDeposit(
    uint256 _lockForDays,
    int256 _minExpectedPrice
)
```

This function is used to configure an ETH deposit for `_lockForDays` duration. Deposit can optionally be released early if configured `_minExpectedPrice` is reported by a price oracle. If `_minExpectedPrice` is set to `0` then this condition is ommited.

As a result of executing this method a `LockerPass` NFT token will be minted to your account. As long as you're an owner of a target NFT representing your deposit you'll be able to manage and withdraw the deposited Ether.

#### `deposit`

```solidity
function deposit(
    uint256 _depositId
)
```

This method adds the sent Ether value to the target `_depositId`. You must be owner of a `LockerPass` NFT with a target `_depositId` to execute this method.

**Arguments:**

* `_depositId`: ID of a target deposit

#### `canWithdraw`

```solidity
function canWithdraw(
    uint256 _depositId
) returns (bool)
```

Returns `true` if the specified `_depositId` be withdrawn by an owner. The withdrawal is allowed if the lock period is over, or if the expected price is reached.

**Arguments:**

* `_depositId`: ID of a target deposit

#### `withdraw`

```solidity
function withdraw(
    uint256 _depositId
)
```

This method withdraws ETH deposited in a target `_depositId` and burns associated `LockerPass` NFT token. It can be executed only if `canWithdraw` returns `true` for a target `_depositId`.

#### `increaseMinExpectedPrice`

```solidity
function increaseMinExpectedPrice(
  int256 _newMinExpectedPrice
  uint256 _depositId
)
```

Increases the minimum expected price for the specified `_depositId` to `_newMinExpectedPrice`, if it is greater than the current minimum expected price.

#### `increaseLockForDays`

```solidity
function increaseLockForDays(
  int256 _newLockForDays
  uint256 _depositId
)
```

Increases the lock period for the specified `_depositId` to `_newLockForDays`, if it is greater than the current lock period.

#### `deposits`

```solidity
mapping(uint256 => DepositData) deposits;
```

A nested hash representing configuration of all configured deposits. You can use it to read configuration based on a `_depositId`.

## NFTLocker.sol

The NFTLocker smart contract is designed to allow users to lock and manage their non-fungible tokens (NFTs) for a specified period of time. Users can deposit their NFTs into the contract, set a lock duration, and then withdraw them only after the lock period has expired. This contract provides a way to hold NFTs temporarily and ensure they cannot be withdrawn until the specified time has passed.

### API

Each user account can configure any number of distinct ERC721 token instances.

#### `deposit`

```solidity
function deposit(
    address _token,
    uint256 _depositId,
    uint256 _lockForDays
)
```

Allows users to deposit an NFT into the contract. Target token will be released only after the configured time period has passed.

**Arguments:**

* `_token`: Address of ERC721 token to be configured.
* `_depositId`: ID of target NFT instance to be configured.
* `_lockForDays`: The number of days the tokens will be locked.

Before configuring the ERC721 token instance conditions you have to approve `Locker` contract to transfer it from your account. To do it you have to make the following method call:

```solidity
  ERC721(tokenAddress).approve(lockerAddress, tokenId);
```

#### `canWithdraw`

```solidity
function canWithdraw(
    address _account,
    address _token,
    uint256 _tokenId
) returns (bool)
```

Checks if a user can withdraw a specific NFT.

#### `withdraw`

```solidity
function withdraw(
    address _token,
    uint256 _tokenId
)
```

Allows users to withdraw an NFT that has reached its lock duration and transfers the NFT back to the user.

#### `increaseLockForDays`

```solidity
function increaseLockForDays(
  address _token,
  uint256 _tokenId,
  int256 _newLockForDays
)
```

Allows users to increase the lock duration for a previously deposited NFT.

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
* [Arbitrum Mainnet](https://arbiscan.io/address/0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612)

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
docker run -it -v ./:/share/Locker trailofbits/eth-security-toolbox
cd /share/Locker
slither .
```

