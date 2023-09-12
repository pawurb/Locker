import { ethers } from "hardhat";
import hardhat from "hardhat";
const prompt = require('prompt-sync')();

async function main() {
  const confirm = prompt(`Deploy ERC20Locker to ${hardhat.network.name}? CONFIRM? `);
  if(confirm != 'CONFIRM') {
    console.log("Abandoning");
    process.exit(0)
  }

  const locker = await ethers.deployContract("ERC20Locker");
  await locker.waitForDeployment()

  console.log(
    `ETHLocker deployed to ${locker.target}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
