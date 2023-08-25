import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect, assert } from "chai";
import { ethers } from "hardhat";
import {
    BN,
    constants,
    expectEvent,
    expectRevert,
    send,
} from "@openzeppelin/test-helpers";

const advanceByDays = async (days) => {
  await time.increase(days * 86400)
}

const TOKEN_ID = 1;

describe("NFTLocker", () => {
  let locker;
  let nftA;
  let nftB;
  let user1
  let user2

  const setup = async (opts) => {
    user1 = (await ethers.getSigners())[0]
    user2 = (await ethers.getSigners())[1]
    const NFTLocker = await ethers.getContractFactory("NFTLocker");
    const MockERC721A = await ethers.getContractFactory("MockERC721A");
    const MockERC721B = await ethers.getContractFactory("MockERC721B");
    locker = await NFTLocker.deploy()
    nftA = await MockERC721A.deploy()
    nftB = await MockERC721B.deploy()
  }

  beforeEach(async () => {
    await setup()
    await nftA.connect(user1).mint()
    await nftA.connect(user1).mint()
    await nftA.connect(user2).mint()
  })

  it("can be deployed", async () => {
    assert.ok(locker.address)
  })

  describe("mock NFTs", async () => {
    it("are correctly created", async () => {
      let balanceA = await nftA.balanceOf(user1.address);
      expect(balanceA).to.equal(2)
      let balanceB = await nftA.balanceOf(user2.address);
      expect(balanceB).to.equal(1)

      let totalSupply = await nftA.totalSupply()
      expect(totalSupply).to.equal(3)
    })
  })

  describe("NFT tranfers", async () => {
    it("contract does not accept non-configured NFTs", async () => {
      await expectRevert(
        nftA["safeTransferFrom(address,address,uint256)"](user1.address, locker.address, TOKEN_ID)
      , "not configured")
    })
  })

  describe("'deposit'", async () => {
    it("adds correct data to 'configuredDeposits'", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10)
      const depositData = await locker.deposits(user1.address, nftA.address, TOKEN_ID)
      expect(depositData.lockForDays).to.equal(10)
    })

    it("lockForDays must be larger then 0", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await expectRevert(
        locker.deposit(nftA.address, TOKEN_ID, 0)
      , "Invalid")
    })

    it("transfers NFT token to the contract", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10)
      let newOwner = await nftA.ownerOf(TOKEN_ID);
      expect(newOwner).to.equal(locker.address)
    })

    it("reverts unless target NFT was approved for transfer", async () => {
      await expectRevert(
        locker.deposit(nftA.address, TOKEN_ID, 10)
      , "caller is not token owner")
    })

    it("reverts unless target NFT is owner by the account", async () => {
      await expectRevert(
        locker.deposit(nftA.address, TOKEN_ID + 1, 10)
      , "caller is not token owner")
    })

    it("allows deposit for multiple token IDs", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10)
      const depositData = await locker.deposits(user1.address, nftA.address, TOKEN_ID)
      expect(depositData.lockForDays).to.equal(10)

      await nftA.approve(locker.address, TOKEN_ID - 1);
      await locker.deposit(nftA.address, TOKEN_ID - 1, 20)
      const depositData2 = await locker.deposits(user1.address, nftA.address, TOKEN_ID - 1)
      expect(depositData2.lockForDays).to.equal(20)
    })

    it("allows deposit for different NFT types", async () => {
      await nftB.mint()
      await nftB.approve(locker.address, 0);
      await locker.deposit(nftB.address, 0, 15)

      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10)

      const depositData = await locker.deposits(user1.address, nftB.address, 0)
      expect(depositData.lockForDays).to.equal(15)
    })

    it("does not allow deposit for the same token IDs", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, 1, 10)

      await expectRevert(
        locker.deposit(nftA.address, 1, 10)
      , "already configured")
    })
  })

  describe('canWithdraw', async () => {
    it("token was not configured it raises an error", async () => {
      await expectRevert(
        locker.canWithdraw(user1.address, nftA.address, TOKEN_ID)
      , "not configured")

      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10)
      await advanceByDays(9)

      const result = await locker.canWithdraw(user1.address, nftA.address, TOKEN_ID)
      expect(result).to.equal(false)
    })

    it("time for holding the token has passed it returns true", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10)
      await advanceByDays(21)
      const result = await locker.canWithdraw(user1.address, nftA.address, TOKEN_ID)
      expect(result).to.equal(true)
    })
  })

  describe("'withdraw'", async () => {
    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.withdraw(nftA.address, TOKEN_ID)
      , "not configured")
    })

    it("returns correct NFT tokens only when withdrawal conditions are correct", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10)

      await expectRevert(
        locker.withdraw(nftA.address, TOKEN_ID)
      , "cannot withdraw")

      await advanceByDays(21)

      await expect(locker.withdraw(nftA.address, TOKEN_ID))
      .to.changeTokenBalances(
        nftA,
        [locker.address, user1.address],
        [-1, 1]
      )

      const depositData = await locker.deposits(user1.address, nftA.address, TOKEN_ID)
      expect(depositData.lockForDays).to.equal(0)
      expect(depositData.createdAt).to.equal(0)
    })

    it("does not allow withdrawing by other account", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10)

      await expectRevert(
        locker.withdraw(nftA.address, TOKEN_ID)
      , "cannot withdraw")

      await advanceByDays(21)

      await expectRevert(
        locker.connect(user2).withdraw(nftA.address, TOKEN_ID)
      , "not configured")
    })

    it("does not affect balances of other users", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await nftA.connect(user2).approve(locker.address, TOKEN_ID + 1);

      await locker.deposit(nftA.address, TOKEN_ID, 10);
      await locker.connect(user2).deposit(nftA.address, TOKEN_ID + 1, 20);

      await advanceByDays(12)

      await expectRevert(
        locker.connect(user2).withdraw(nftA.address, TOKEN_ID + 1),
        "cannot withdraw"
      )

      await expect(locker.withdraw(nftA.address, TOKEN_ID))
      .to.changeTokenBalances(
        nftA,
        [locker.address, user1.address],
        [-1, 1]
      )

      const depositData1 = await locker.deposits(user1.address, nftA.address, TOKEN_ID)
      expect(depositData1.lockForDays).to.equal(0)

      const depositData2 = await locker.deposits(user2.address, nftA.address, TOKEN_ID + 1)
      expect(depositData2.lockForDays).to.equal(20)
    })
  })

  describe("'increaseLockForDays'", async () => {
    beforeEach(async() => {
      await nftA.approve(locker.address, TOKEN_ID);
      await locker.deposit(nftA.address, TOKEN_ID, 10);
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.increaseLockForDays(nftA.address, TOKEN_ID + 1, 25)
      , "not configured")
    })

    it("does not allow decreasing the lock duration", async () => {
      await expectRevert(
        locker.increaseLockForDays(nftA.address, TOKEN_ID, 5)
      , "invalid")
    })

    it("allows increasing the lock duration", async () => {
      await locker.increaseLockForDays(nftA.address, TOKEN_ID, 15)

      const depositData = await locker.deposits(user1.address, nftA.address, TOKEN_ID)
      expect(depositData.lockForDays).to.equal(15)
    })
  })

  describe("'getDepositors'", async () => {
    it("returns array of configured account addresses", async () => {
      await nftA.approve(locker.address, TOKEN_ID);
      await nftA.connect(user2).approve(locker.address, TOKEN_ID + 1);
      await locker.deposit(nftA.address, TOKEN_ID, 10);
      await locker.connect(user2).deposit(nftA.address, TOKEN_ID + 1, 20);

      const depositors = await locker.getDepositors()
      expect(depositors[0]).to.equal(user1.address)
      expect(depositors[1]).to.equal(user2.address)
      expect(depositors.length).to.equal(2)
    })
  })
})
