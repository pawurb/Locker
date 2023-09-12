import { ethers } from "hardhat";
import hardhat from "hardhat";

async function main() {
  let usdEthOracle

  if(hardhat.network.name == "mainnet") {
    usdEthOracle = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
  }

  if(hardhat.network.name == "goerli") {
    usdEthOracle = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e"
  }

  const locker = await ethers.deployContract("ETHLocker", [usdEthOracle]);
  await locker.deployTransaction.wait()

  console.log(
    `ETHLocker deployed to ${locker.deployTransaction.creates}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
