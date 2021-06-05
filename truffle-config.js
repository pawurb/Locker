module.exports = {
  networks: {
    test: {
      host: "0.0.0.0",
      port: 8545,
      network_id: "*",
      gasPrice: 1
    }
  },
  mocha: {
  },
  compilers: {
    solc: {
      version: "0.8.4"
    }
  },
  db: {
    enabled: false
  }
};
