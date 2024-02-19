import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import secrets from "./.secrets.json"

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
    },
  },
  networks: {
    goerli: {
      url: secrets["goerliEndpoint"],
      accounts: [secrets["georliPrivateKey"]]
    },
    mainnet: {
      url: secrets["mainnetEndpoint"],
      accounts: [secrets["mainnetPrivateKey"]]
    },
    arbitrum: {
      url: secrets["arbitrumEndpoint"],
      accounts: [secrets["arbitrumPrivateKey"]]
    },
    optimism: {
      url: secrets["optimismEndpoint"],
      accounts: [secrets["arbitrumPrivateKey"]]
    }
  },
  etherscan: {
    apiKey: {
      mainnet: secrets["etherscanAPIKey"],
      goerli: secrets["etherscanAPIKey"],
      arbitrumOne: secrets["arbiscanAPIKey"],
      optimisticEthereum: secrets["optimisticAPIKey"]
    }
  }
};

export default config;
