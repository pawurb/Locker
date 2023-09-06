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

const oneEther = ethers.utils.parseEther("1.00")

describe("ETHLocker", () => {
  let smartHold
  let priceFeed
  let user1
  let user2

  const setup = async (opts) => {
    opts.priceFeedContract = opts.priceFeedContract || "PriceFeedMock"
    opts.constructorValue = opts.constructorValue || null
    opts.currentPrice = opts.currentPrice || 1000

    user1 = (await ethers.getSigners())[0]
    user2 = (await ethers.getSigners())[1]

    const PriceFeedMock = await ethers.getContractFactory(
      opts.priceFeedContract
    )
    const ETHLocker = await ethers.getContractFactory("ETHLocker")
    priceFeed = await PriceFeedMock.deploy(opts.currentPrice * 10e7)
    smartHold = await ETHLocker.deploy(priceFeed.address, {
      value: opts.constructorValue,
    })
  }

  describe("Constructor", () => {
    it("does not accept funds on initialization", async () => {
      await expectRevert(
        setup({ constructorValue: ethers.utils.parseEther("2.01") }),
        "non-payable"
      )
    })

    it("can be deployed", async () => {
      await setup({})
    })
  })

  describe("'configuredDeposit'", () => {
    beforeEach(async () => {
      await setup({})
    })

    it("reader methods return null object error if account is not configured", async () => {
      expect(
        (await smartHold.connect(user2).deposits(user2.address)).createdAt
      ).to.equal(0)
    })

    it("accepts funds and sets correct default values", async () => {
      await smartHold.configureDeposit(10, 0, { value: oneEther })

      expect((await smartHold.deposits(user1.address)).lockForDays).to.equal(10)
      expect((await smartHold.deposits(user1.address)).balance).to.equal(
        oneEther
      )
      expect(
        (await smartHold.deposits(user1.address)).minExpectedPrice
      ).to.equal(0)
      assert.ok((await smartHold.deposits(user1.address)).createdAt)
    })

    it("does not allow configuring twice", async () => {
      await smartHold.configureDeposit(10, 0, { value: oneEther })

      await expectRevert(
        smartHold.configureDeposit(10, 0, { value: oneEther }),
        "already configured"
      )
    })

    it("does not accept negative expected price", async () => {
      await expectRevert(
        smartHold.configureDeposit(10, -100, { value: oneEther }),
        "Invalid minExpectedPrice"
      )
    })

    it("accepts initial config without depositing funds", async () => {
      await smartHold.configureDeposit(10, 0)
      expect((await smartHold.deposits(user1.address)).balance).to.equal(0)
      assert.ok((await smartHold.deposits(user1.address)).createdAt)
    })
  })

  describe("'deposit'", () => {
    beforeEach(async () => {
      await setup({})
    })

    it("throws an error for non configured accounts", async () => {
      await expectRevert(
        smartHold.deposit({ value: oneEther }),
        "not configured"
      )
    })

    it("accepts funds and increases correct account balance", async () => {
      await smartHold.configureDeposit(10, 0, { value: oneEther })
      expect((await smartHold.deposits(user1.address)).balance).to.equal(
        oneEther
      )
      await smartHold.deposit({ value: oneEther })
      expect((await smartHold.deposits(user1.address)).balance).to.equal(
        oneEther.mul(2)
      )
    })

    it("does not accept ETH transfer without method call", async () => {
      await expectRevert(
        user1.sendTransaction({ value: oneEther, to: smartHold.address }),
        "transaction may fail"
      )
    })
  })

  describe("'canWithdraw'", () => {
    beforeEach(async () => {
      await setup({})
    })

    it("account was not configured it raises an error", async () => {
      await expectRevert(smartHold.canWithdraw(user1.address), "not configured")
    })

    it("return false for configured account", async () => {
      await smartHold.configureDeposit(10, 0, { value: oneEther })
      await advanceByDays(9)
      expect(await smartHold.canWithdraw(user1.address)).to.equal(false)
    })

    it("return true if time has passed", async () => {
      await smartHold.configureDeposit(10, 0, { value: oneEther })
      await advanceByDays(11)
      expect(await smartHold.canWithdraw(user1.address)).to.equal(true)
    })

    describe("price conditions", async () => {
      beforeEach(async () => {
        await setup({ currentPrice: 1000 })
      })

      it("minimumExpectedPrice has been configured and is higher than the current price it returns false", async () => {
        await smartHold.configureDeposit(10, 1100, { value: oneEther })
        expect(await smartHold.canWithdraw(user1.address)).to.equal(false)
      })

      it("minimumExpectedPrice has been configured and is lower than the current price it returns true", async () => {
        await smartHold.configureDeposit(10, 900, { value: oneEther })
        expect(await smartHold.canWithdraw(user1.address)).to.equal(true)
      })
    })

    describe("buggy price oracle", async () => {
      beforeEach(async () => {
        await setup({ priceFeedContract: "BuggyPriceFeedMock" })
      })

      it("raises an error if time to hold funds has not yet passed", async () => {
        await smartHold.configureDeposit(10, 900, { value: oneEther })

        await expectRevert(smartHold.canWithdraw(user1.address), "oracle bug")
      })

      it("returns true if time to hold funds has passed", async () => {
        await smartHold.configureDeposit(10, 900, { value: oneEther })

        await advanceByDays(20)
        expect(await smartHold.canWithdraw(user1.address)).to.equal(true)
      })
    })
  })

  describe("'withdraw'", async () => {
    beforeEach(async () => {
      await setup({})
    })

    it("raises an error if conditions are not fulfilled", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })
      await expectRevert(smartHold.withdraw(), "cannot withdraw")
    })

    it("raises an error if conditions are not fulfilled", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })
      await expectRevert(smartHold.withdraw(), "cannot withdraw")
    })

    it("sends ETH tokens to correct account if conditions are fulfilled", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })

      expect((await smartHold.deposits(user1.address)).balance).to.equal(
        oneEther
      )
      await advanceByDays(11)

      await expect(smartHold.withdraw()).to.changeEtherBalances(
        [user1, smartHold],
        [oneEther, oneEther.mul(-1)]
      )

      expect((await smartHold.deposits(user1.address)).balance).to.equal(0)
    })

    it("sends correct amound funds and does not affect deposits of other users", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther.mul(2) })
      await smartHold
        .connect(user2)
        .configureDeposit(10, 1100, { value: oneEther })
      expect((await smartHold.deposits(user1.address)).balance).to.equal(
        oneEther.mul(2)
      )
      expect((await smartHold.deposits(user2.address)).balance).to.equal(
        oneEther
      )

      await advanceByDays(11)

      await expect(smartHold.connect(user2).withdraw()).to.changeEtherBalances(
        [user2, smartHold],
        [oneEther, oneEther.mul(-1)]
      )

      expect((await smartHold.deposits(user1.address)).balance).to.equal(
        oneEther.mul(2)
      )
      expect((await smartHold.deposits(user2.address)).balance).to.equal(0)
    })
  })

  describe("'increaseLockForDays'", async () => {
    beforeEach(async () => {
      await setup({})
    })

    it("can only be executed by a configured account", async () => {
      await expectRevert(smartHold.increaseLockForDays(25), "not configured")
    })

    it("it does not accept smaller then current value", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(smartHold.increaseLockForDays(8), "value invalid")
    })

    it("allows increasing lock for days value", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })

      await smartHold.increaseLockForDays(12)
      expect((await smartHold.deposits(user1.address)).lockForDays).to.equal(12)
    })

    it("does not allow overflowing lock for days value", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(smartHold.increaseLockForDays(2 ** 256), "overflow")
    })

    it("has maximum lock duration of 10k days", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(smartHold.increaseLockForDays(10001), "Too long")
    })
  })

  describe("'increaseMinExpectedPrice'", async () => {
    beforeEach(async () => {
      await setup({})
    })

    it("can only be executed by a configured account", async () => {
      await expectRevert(
        smartHold.increaseMinExpectedPrice(25),
        "not configured"
      )
    })

    it("it does not accept smaller then current value", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(
        smartHold.increaseMinExpectedPrice(900),
        "value invalid"
      )
    })

    it("allows increasing min expected price", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })

      await smartHold.increaseMinExpectedPrice(1200)
      expect(
        (await smartHold.deposits(user1.address)).minExpectedPrice
      ).to.equal(1200)
    })

    it("does not allow overflowing min expected price value", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(
        smartHold.increaseMinExpectedPrice(2 ** 256),
        "overflow"
      )
    })

    it("does not allow changing price if previously set to 0", async () => {
      await smartHold.configureDeposit(10, 0, { value: oneEther })

      await expectRevert(
        smartHold.increaseMinExpectedPrice(10),
        "not configured"
      )
    })
  })

  describe("'getDepositors'", async () => {
    beforeEach(async () => {
      await setup({})
    })

    it("returns array of depositors addresses", async () => {
      await smartHold.configureDeposit(10, 1100, { value: oneEther })
      await smartHold
        .connect(user2)
        .configureDeposit(10, 1000, { value: oneEther })

      const deposits = await smartHold.getDepositors()
      expect(deposits[0]).to.equal(user1.address)
      expect(deposits[1]).to.equal(user2.address)
      expect(deposits.length).to.equal(2)
    })
  })
})
