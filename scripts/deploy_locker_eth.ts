import { ethers } from "hardhat";
import hardhat from "hardhat";
const prompt = require('prompt-sync')();

async function main() {
  const confirm = prompt(`Deploy ETHLocker to ${hardhat.network.name}? CONFIRM? `);

  if(confirm != 'CONFIRM') {
    console.log("Abandoning");
    process.exit(0)
  }

  let usdEthOracle

  if(hardhat.network.name == "mainnet") {
    usdEthOracle = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
  }

  if(hardhat.network.name == "goerli") {
    usdEthOracle = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e"
  }

  if(hardhat.network.name == "arbitrum") {
    usdEthOracle = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"
  }

  const locker = await ethers.deployContract("ETHLocker", [usdEthOracle]);
  await locker.waitForDeployment()

  console.log(
    `ETHLocker deployed to ${locker.target}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
