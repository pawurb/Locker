import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import secrets from "./.secrets.json"

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    goerli: {
        url: secrets["goerliEndpoint"],
        accounts: [secrets["georliPrivateKey"]]
      }
  },
  etherscan: {
    apiKey: secrets["etherscanAPIKey"]
  }
};

export default config;
