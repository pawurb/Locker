import { ethers } from "hardhat";

async function main() {
  const locker = await ethers.deployContract("ETHLocker", ["0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e"]);

  await locker.deployTransaction.wait()

  console.log(
    `ETHLocker deployed to ${locker.deployTransaction.creates}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
