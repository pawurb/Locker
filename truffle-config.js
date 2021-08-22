module.exports = {
  compilers: {
    solc: {
      version: "0.8.4"
    }
  },
  db: {
    enabled: false
  },
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // match any network
    }
  }
};
