# SmartHold - a simple way to lock and hold your ETH or ERC20 in a smart contract [![CircleCI](https://circleci.com/gh/pawurb/SmartHold-contracts.svg?style=svg)](https://circleci.com/gh/pawurb/SmartHold-contracts)

**This is a BETA software that has not been audited for security. USE AT YOUR OWN RISK!**

**Disclaimer: The information provided in the readme is for educational purposes only and should not be treated as investment advice.**

[Story of the project](https://pawelurbanek.com/smart-contract-development)

## SmartHoldPublic

![Mr Bean rollercoaster](https://github.com/pawurb/SmartHold-contracts/raw/master/mr-bean-rollercoaster.gif)

The `SmartHoldPublic` contract can be used to lock your Ether for a predefined period of time. Optionally, you can configure an ETH/USD price value that will release the Ether. Compared to other contracts, it can be used by everyone, not only the account that deployed it.

You can deploy your contract instance or use already deployed contracts:

* [Mainnet](https://etherscan.io/address/0xDCEE8f33608FA6563ef1731f772B7b2ac3589160)
* [Goerli](https://goerli.etherscan.io/address/0xd18f13ebad28cd16bf14096a128627c750a88ea7)

### API

`constructor(address _priceFeed)`

* `_priceFeedAddress` - `[address]` address of the price feed oracle contract.

You can interact with a deployed contract using the following methods:

![Etherscan interface](https://github.com/pawurb/SmartHold-contracts/raw/master/configure-deposit.png)

* `configureDeposit(uint256 _lockForDays, int256 _minExpectedPrice)` - call this method to create your deposit. You can specify `_lockForDays` to set how long your funds should be locked. `_minExpectedPrice` is ETH price in USD as reported by configured price oracle. If Ether price is larger then configured minimum price, you'll be able to withdraw your funds even if the lock period has not expired. You can set `_minExpectedPrice` to `0` to disable releasing funds based on price. This method is `payable`, so optionally, you can use it to deposit initial funds.
* `deposit()` - using this method, you can add more funds if your account is already configured.
* `canWithdraw(address _account) returns (bool)` - check if a provided address can withdraw funds.
* `withdraw()` - withdraw funds to the caller's address if possible.
* `increaseLockForDays(uint256 _newLockForDays)` - increase the lock duration for your deposit.
* `increaseMinExpectedPrice(int256 _newMinExpectedPrice)` - min expected price for your deposit. You can use this method if the price condition is already configured.

## SmartHoldETH

The `SmartHoldETH` contract can be used to lock your Ether for a predefined period of time. Optionally, you can configure an ETH/USD price value that will release the Ether. You need to deploy the contract with the following arguments:

```node
const deposit = await SmartHoldETH.new(
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

## SmartHoldERC20

This contract can hold both ERC20 and ETH tokens. You can use the contract in the following way:

```node
const deposit = await SmartHoldERC20.new()
await deposit.configureToken(
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
docker run -it -v ~/SmartHold-contracts/:/share trailofbits/eth-security-toolbox
cd /share/SmartHold-contracts
slither .
```

