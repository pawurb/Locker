# SmartHold Ethereum contracts  [![CircleCI](https://circleci.com/gh/pawurb/SmartHold-contracts.svg?style=svg)](https://circleci.com/gh/pawurb/SmartHold-contracts)

**This is a BETA software which has not been audited for security. USE AT YOUR OWN RISK!**

**Disclaimer: The information provided in readme is for educational purposes only and should not be treated as investment advice.**

## SmartHoldETH

The `SmartHoldETH` contract can be used to lock your Ether for a predefined period of time. Optionally, you can configure a ETH/USD price value that will release the Ether. You need to initialize the contract with the following arguments:

```nodejs
  SmartHoldETH.new(
    oracleAddress, // [address] Address of the price feed oracle contract (see below)
    lockForDays, // [uint] Number of days that you want to lock your funds for (max 4000)
    minimumPrice, // [int] Minimum price (in USD) that would release the funds
  )
```

API:

`canWidthraw -> bool` - check if funds can be widthrawn

`widthraw -> bool` - widthraw funds

You can send more Ether to the contract after it has been initialized. Only maker of the contract can widthraw the funds. Don't send ERC20 tokens to this contract because they will be lost forever.

## SmartHoldERC20

[WIP]

## Dependencies

ETH/USD price oracles powered by [ChainLink](https://chain.link/):

* [Mainnet](https://etherscan.io/address/0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419)
* [Kovan](https://kovan.etherscan.io/address/0x9326BFA02ADD2366b30bacB125260Af641031331#code)

## Setup

```bash
asdf install
npm install
cp docker-compose.yml.sample docker-compose.yml
docker compose up -d
truffle test
```

### Security scan

```bash
docker pull trailofbits/eth-security-toolbox
docker run -it -v ~/SmartHold-contracts/:/share trailofbits/eth-security-toolbox
cd /share/SmartHold-contracts
slither .
```
