import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import secrets from "./.secrets.json"

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
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
    }
  },
  etherscan: {
    apiKey: secrets["etherscanAPIKey"]
  }
};

export default config;
