# SmartHold - a simple way to lock and hold your Ethereum in a smart contract [![CircleCI](https://circleci.com/gh/pawurb/SmartHold-contracts.svg?style=svg)](https://circleci.com/gh/pawurb/SmartHold-contracts)

**This is a BETA software which has not been audited for security. USE AT YOUR OWN RISK!**

**Disclaimer: The information provided in readme is for educational purposes only and should not be treated as investment advice.**

[Story of the project](https://pawelurbanek.com/smart-contract-development)

## SmartHoldETH

The `SmartHoldETH` contract can be used to lock your Ether for a predefined period of time. Optionally, you can configure a ETH/USD price value that will release the Ether. You need to initialize the contract with the following arguments:

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
  "BAT",
  0x0d8775f648430679a709e98d2b0cb6250d2887ef,
  750,
  0x9441D7556e7820B5ca42082cfa99487D56AcA958,
  5,
  10e7
)
```

### API

`configureToken(string memory _symbol, address _tokenAddress, uint256 _lockForDays, address _feedAddress, int256 _minExpectedPrice, int256 _pricePrecision)`

* `_tokenSymbol` - `[string]` symbol of a token, i.e. 'BAT' or 'ETH'
* `_tokenAddress` - `[address]` address of an ERC20 token, i.e. [`BAT`](https://etherscan.io/token/0x0d8775f648430679a709e98d2b0cb6250d2887ef) or [`ETH`](https://etherscan.io/token/0x0000000000000000000000000000000000000000)
* `_lockForDays` - `[uint256]` how many days you want to lock the token for, counted since contract creation
* `_priceFeedAddress` - `[address]` address of a ChainLink price feed contract, e.g., [ETH/USD on Mainnet](https://etherscan.io/address/0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419). Provide a [zero address](https://etherscan.io/address/0x0000000000000000000000000000000000000000) if you don't want to withdraw based on price conditions.
* `_minExpectedPrice` - `[int256]` minimum price (in units corresponding to configured `_pricePrecision`) that would release the funds (setting it to 0 disables this condition)
* `_pricePrecision` - `[int256]` precision of price returned by a price feed, i.e. `10e7` for dollars and `10e5` for cents

Before configuring the token you can validate the price feed address and precision using the following method:

`checkPriceFeed(address _feedAddress, int256 _precision) returns (int256)`
* `_feedAddress` -`[address]` address of a ChainLink price feed oracle
* `_precision` - `[int256] precision of returned price values, e.g., `10e7` for dollars and `10e5` for cents

You can only configure each token once. After it is configured you can increase the expected minimum price, and lock for days duration. Using the following methods:

`increaseMinExpectedPrice(string memory _symbol, int256 _newMinExpectedPrice)`
* `_symbol` - `[string]` symbol of a token
* `_newMinExpectedPrice` - `[int256]` new value of a minimum expected price

`increaseLockForDays(string memory _symbol, uint256 _newLockForDays)`
* `_symbol` - `[string]` symbol of a token
* `_newLockForDays` - `[uint256]` new number of days that you want to lock the funds for

You can check if a given token can be withdrawn by using:

`canWithdraw(string memory _symbol) returns (bool)`
* `_symbol` - `[string]` symbol of a token

If the above method returns `true` you can withdrawn a selected token using:

`withdraw(string memory _symbol)`
* `_symbol` - `[string]` symbol of a token

Tokens will be returned to the address of a contract maker.

## Price feeds

ETH/USD price oracles powered by [ChainLink](https://docs.chain.link/docs/get-the-latest-price/):

* [Mainnet](https://etherscan.io/address/0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419)
* [Kovan](https://kovan.etherscan.io/address/0x9326BFA02ADD2366b30bacB125260Af641031331#code)

[More price feeds](https://data.chain.link/).

Please be aware that ChainLink price feeds are not guaranteed to always return the correct data. In case they stop responding you'll only be able to withdraw your funds once the lock period has expired.

## Setup

```bash
asdf install
npm install
cp docker-compose.yml.sample docker-compose.yml
docker compose up -d
npm run link
npm run test
```

### Security scan

```bash
docker pull trailofbits/eth-security-toolbox
docker run -it -v ~/SmartHold-contracts/:/share trailofbits/eth-security-toolbox
cd /share/SmartHold-contracts
slither .
```
