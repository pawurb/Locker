import { time } from "@nomicfoundation/hardhat-network-helpers"
import { expect, assert } from "chai"
import { ethers } from "hardhat"
import {
  BN,
  constants,
  expectEvent,
  expectRevert,
  send,
} from "@openzeppelin/test-helpers"

const advanceByDays = async (days) => {
  await time.increase(days * 86400)
}

describe("ETHLockerPriv", () => {
  let locker
  let owner
  let notOwner
  const value = new BN(ethers.parseEther("0.21"))
  const lockForDays = 100

  const setup = async (opts) => {
    opts.minimumPrice = opts.minimumPrice || 0
    opts.currentPrice = opts.currentPrice || 0
    opts.lockForDays = opts.lockForDays || 1000
    opts.priceFeedContract = opts.priceFeedContract || "PriceFeedMock"

    owner = (await ethers.getSigners())[0]
    notOwner = (await ethers.getSigners())[1]

    const PriceFeedMock = await ethers.getContractFactory(
      opts.priceFeedContract
    )
    const ETHLockerPriv = await ethers.getContractFactory("ETHLockerPriv")
    const priceFeed = await PriceFeedMock.deploy(opts.currentPrice * 10e7)
    locker = await ETHLockerPriv.deploy(
      priceFeed.target,
      opts.lockForDays,
      opts.minimumPrice,
      {
        value: value.toString(),
      }
    )
  }

  beforeEach(async () => {
    await setup({
      currentPrice: 0,
      minimumPrice: 10000,
      lockForDays: lockForDays,
    })
  })

  describe("Constructor", () => {
    it("does not allow locking funds for too long", async () => {
      await expectRevert(setup({ lockForDays: 20000 }), "Too long")
    })

    it("does not accept negative minimum price", async () => {
      await expectRevert(setup({ minimumPrice: -20 }), "Price must not")
    })

    it("contract gets deployed to test network and accepts initial ETH transfer", async () => {
      assert.ok(locker.target)

      expect(await ethers.provider.getBalance(locker.target)).to.equal(
        value
      )
    })

    it("sets the correct owner and other attributes", async () => {
      assert.equal(await locker.owner(), owner.address)

      assert.equal(await locker.lockForDays(), 100)

      assert.equal(await locker.minimumPrice(), 10000)
    })

    it("accepts more ETH transfer after deployment", async () => {
      await owner.sendTransaction({ value: value.toString(), to: locker.target })

      expect(await ethers.provider.getBalance(locker.target)).to.equal(
        value.add(value)
      )
    })
  })

  describe("'withdraw'", async () => {
    it("can only be called by the deposit contract owner", async () => {
      await expectRevert(
        locker.connect(notOwner).withdraw(),
        "Access denied"
      )
    })

    it("required time did not pass yet, it does not withdraw funds", async () => {
      await expectRevert(locker.withdraw(), "Cannot withdraw")
    })

    it("required time has already passed, it withdraws funds", async () => {
      await advanceByDays(lockForDays + 1)
      const canWithdrawAfter = await locker.canWithdraw()
      expect(canWithdrawAfter).to.equal(true)

      await expect(locker.withdraw()).to.changeEtherBalances(
        [owner, locker],
        [value.toString(), value.sub(value).sub(value).toString()]
      )
    })
  })

  describe("withdrawing based on price", async () => {
    describe("required min price is met", async () => {
      beforeEach(async () => {
        await setup({ currentPrice: 123, minimumPrice: 100 })
      })

      it("it withdraws funds", async () => {
        const canWithdraw = await locker.canWithdraw()
        expect(canWithdraw).to.equal(true)
      })
    })

    describe("required min price is not met", async () => {
      beforeEach(async () => {
        await setup({ currentPrice: 90, minimumPrice: 100 })
      })

      it("it does not withdraw funds", async () => {
        const canWithdraw = await locker.canWithdraw()
        expect(canWithdraw).to.equal(false)
      })
    })

    describe("contract does not use price condition for withdrawal and time did not pass yet", async () => {
      beforeEach(async () => {
        await setup({ currentPrice: 100, minimumPrice: 0 })
      })

      it("it does not withdraw funds", async () => {
        const canWithdraw = await locker.canWithdraw()
        expect(canWithdraw).to.equal(false)
      })
    })

    describe("price feed execution returns error and required time has not yet passed", async () => {
      it("crashes", async () => {
        await setup({
          minimumPrice: 1500,
          priceFeedContract: "BuggyPriceFeedMock",
        })
        await expectRevert(locker.canWithdraw(), "Price oracle bug!")
      })
    })

    describe("price feed execution returns error and required time has already passed", async () => {
      it("it withdraws funds", async () => {
        await setup({
          minimumPrice: 1500,
          priceFeedContract: "BuggyPriceFeedMock",
          lockForDays: lockForDays,
        })

        await advanceByDays(lockForDays + 1)
        const canWithdraw = await locker.canWithdraw()
        expect(canWithdraw).to.equal(true)
      })
    })
  })
})
