import { ethers } from "hardhat";
import hardhat from "hardhat";
const prompt = require('prompt-sync')();

async function main() {
  console.log(hardhat.network.name)
  console.log((await ethers.provider.getFeeData()))
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
