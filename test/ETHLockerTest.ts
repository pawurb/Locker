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

const DEPOSIT_ID = 0

describe("ETHLocker", () => {
  let locker
  let lockerPass
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
    locker = await ETHLocker.deploy(priceFeed.address, {
      value: opts.constructorValue,
    })

    let lockerPassAddress = await locker.lockerPass()
    lockerPass = await ethers.getContractAt(
      "contracts/LockerPass.sol:LockerPass",
      lockerPassAddress
    )
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

    it("deploys ETHLockerPass instance and sets itself as an admin", async () => {
      await setup({})
      expect(await lockerPass.admin()).to.equal(locker.address)
      expect(await lockerPass.symbol()).to.equal("LOP")
    })
  })

  describe("'configuredDeposit'", () => {
    beforeEach(async () => {
      await setup({})
    })

    it("reader methods return null object error if account is not configured", async () => {
      expect(
        (await locker.connect(user2).deposits(user2.address)).createdAt
      ).to.equal(0)
    })

    it("accepts funds and sets correct default values", async () => {
      await locker.configureDeposit(10, 0, { value: oneEther })

      let newDepositId = (await lockerPass.nextId()) - 1

      expect(DEPOSIT_ID).to.equal(newDepositId)
      expect(await lockerPass.ownerOf(newDepositId)).to.equal(user1.address)

      expect((await locker.deposits(newDepositId)).lockForDays).to.equal(10)
      expect((await locker.deposits(newDepositId)).balance).to.equal(oneEther)
      expect((await locker.deposits(newDepositId)).minExpectedPrice).to.equal(0)
      assert.ok((await locker.deposits(newDepositId)).createdAt)
    })

    it("mints a LOP NFT and transfers it to the deposit maker", async () => {
      await expect(
        locker.configureDeposit(10, 0, { value: oneEther })
      ).to.changeTokenBalances(
        lockerPass,
        [locker.address, user1.address],
        [0, 1]
      )
    })

    it("allows configuring multiple deposits", async () => {
      await locker.configureDeposit(10, 0, { value: oneEther })
      await locker.configureDeposit(10, 0, { value: oneEther })
      await locker.connect(user2).configureDeposit(10, 0, { value: oneEther })
    })

    it("does not accept negative expected price", async () => {
      await expectRevert(
        locker.configureDeposit(10, -100, { value: oneEther }),
        "Invalid minExpectedPrice"
      )
    })

    it("accepts initial config without depositing funds", async () => {
      await locker.configureDeposit(10, 0)
      expect((await locker.deposits(user1.address)).balance).to.equal(0)
      assert.ok((await locker.deposits(user1.address)).createdAt)
    })
  })

  describe("'deposit'", () => {
    beforeEach(async () => {
      await setup({})
    })

    it("throws an error for non configured accounts", async () => {
      await expectRevert(
        locker.deposit(DEPOSIT_ID, { value: oneEther }),
        "Access denied"
      )
    })

    it("accepts funds and increases correct account balance", async () => {
      await locker.configureDeposit(10, 0, { value: oneEther })
      expect((await locker.deposits(DEPOSIT_ID)).balance).to.equal(oneEther)
      await locker.deposit(DEPOSIT_ID, { value: oneEther })
      expect((await locker.deposits(DEPOSIT_ID)).balance).to.equal(
        oneEther.mul(2)
      )
    })

    it("does not accept ETH transfer without method call", async () => {
      await expectRevert(
        user1.sendTransaction({ value: oneEther, to: locker.address }),
        "transaction may fail"
      )
    })
  })

  describe("'canWithdraw'", () => {
    beforeEach(async () => {
      await setup({})
    })

    it("account was not configured it raises an error", async () => {
      await expectRevert(locker.canWithdraw(DEPOSIT_ID), "not configured")
    })

    it("return false for configured account", async () => {
      await locker.configureDeposit(10, 0, { value: oneEther })
      await advanceByDays(9)
      expect(await locker.canWithdraw(DEPOSIT_ID)).to.equal(false)
    })

    it("return true if time has passed", async () => {
      await locker.configureDeposit(10, 0, { value: oneEther })
      await advanceByDays(11)
      expect(await locker.canWithdraw(DEPOSIT_ID)).to.equal(true)
    })

    describe("price conditions", async () => {
      beforeEach(async () => {
        await setup({ currentPrice: 1000 })
      })

      it("minimumExpectedPrice has been configured and is higher than the current price it returns false", async () => {
        await locker.configureDeposit(10, 1100, { value: oneEther })
        expect(await locker.canWithdraw(DEPOSIT_ID)).to.equal(false)
      })

      it("minimumExpectedPrice has been configured and is lower than the current price it returns true", async () => {
        await locker.configureDeposit(10, 900, { value: oneEther })
        expect(await locker.canWithdraw(DEPOSIT_ID)).to.equal(true)
      })
    })

    describe("buggy price oracle", async () => {
      beforeEach(async () => {
        await setup({ priceFeedContract: "BuggyPriceFeedMock" })
      })

      it("raises an error if time to hold funds has not yet passed", async () => {
        await locker.configureDeposit(10, 900, { value: oneEther })

        await expectRevert(locker.canWithdraw(DEPOSIT_ID), "oracle bug")
      })

      it("returns true if time to hold funds has passed", async () => {
        await locker.configureDeposit(10, 900, { value: oneEther })

        await advanceByDays(20)
        expect(await locker.canWithdraw(DEPOSIT_ID)).to.equal(true)
      })
    })
  })

  describe("'withdraw'", async () => {
    beforeEach(async () => {
      await setup({})
    })

    it("raises an error if conditions are not fulfilled", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })
      await expectRevert(locker.withdraw(DEPOSIT_ID), "cannot withdraw")
    })

    it("sends ETH tokens to correct account if conditions are fulfilled", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })

      expect((await locker.deposits(DEPOSIT_ID)).balance).to.equal(oneEther)
      await advanceByDays(11)

      await expect(locker.withdraw(DEPOSIT_ID)).to.changeEtherBalances(
        [user1, locker],
        [oneEther, oneEther.mul(-1)]
      )

      expect((await locker.deposits(DEPOSIT_ID)).balance).to.equal(0)
    })

    it("burns the correct LockerPass NFT", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })
      await advanceByDays(11)

      await expect(locker.withdraw(DEPOSIT_ID)).to.changeTokenBalances(
        lockerPass,
        [user1],
        [-1]
      )
    })

    it("sends correct amound funds and does not affect deposits of other users", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther.mul(2) })
      await locker
        .connect(user2)
        .configureDeposit(10, 1100, { value: oneEther })
      expect((await locker.deposits(DEPOSIT_ID)).balance).to.equal(
        oneEther.mul(2)
      )
      expect((await locker.deposits(DEPOSIT_ID + 1)).balance).to.equal(oneEther)

      await advanceByDays(11)

      await expect(
        locker.connect(user2).withdraw(DEPOSIT_ID + 1)
      ).to.changeEtherBalances([user2, locker], [oneEther, oneEther.mul(-1)])

      expect((await locker.deposits(DEPOSIT_ID)).balance).to.equal(
        oneEther.mul(2)
      )
      expect((await locker.deposits(DEPOSIT_ID + 1)).balance).to.equal(0)
    })

    it("does not allow withdrawals by account that don't own correct LockerPass NFT", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })
      await advanceByDays(11)

      await expectRevert(
        locker.connect(user2).withdraw(DEPOSIT_ID),
        "Access denied"
      )
    })
  })

  describe("'increaseLockForDays'", async () => {
    beforeEach(async () => {
      await setup({})
    })

    it("can only be executed by a configured account", async () => {
      await expectRevert(
        locker.increaseLockForDays(25, DEPOSIT_ID),
        "Access denied"
      )
    })

    it("it does not accept smaller then current value", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(
        locker.increaseLockForDays(8, DEPOSIT_ID),
        "value invalid"
      )
    })

    it("allows increasing lock for days value", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })

      await locker.increaseLockForDays(12, DEPOSIT_ID)
      expect((await locker.deposits(DEPOSIT_ID)).lockForDays).to.equal(12)
    })

    it("does not allow overflowing lock for days value", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(
        locker.increaseLockForDays(2 ** 256, DEPOSIT_ID),
        "overflow"
      )
    })

    it("has maximum lock duration of 10k days", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(
        locker.increaseLockForDays(10001, DEPOSIT_ID),
        "Too long"
      )
    })
  })

  describe("'increaseMinExpectedPrice'", async () => {
    beforeEach(async () => {
      await setup({})
    })

    it("can only be executed by a configured account", async () => {
      await expectRevert(
        locker.increaseMinExpectedPrice(25, DEPOSIT_ID),
        "Access denied"
      )
    })

    it("can only be executed by a correct account", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })
      await expectRevert(
        locker.connect(user2).increaseMinExpectedPrice(25, DEPOSIT_ID),
        "Access denied"
      )
    })

    it("it does not accept smaller then current value", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(
        locker.increaseMinExpectedPrice(900, DEPOSIT_ID),
        "value invalid"
      )
    })

    it("allows increasing min expected price", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })

      await locker.increaseMinExpectedPrice(1200, DEPOSIT_ID)
      expect((await locker.deposits(DEPOSIT_ID)).minExpectedPrice).to.equal(
        1200
      )
    })

    it("does not allow overflowing min expected price value", async () => {
      await locker.configureDeposit(10, 1100, { value: oneEther })

      await expectRevert(
        locker.increaseMinExpectedPrice(2 ** 256, DEPOSIT_ID),
        "overflow"
      )
    })

    it("does not allow changing price if previously set to 0", async () => {
      await locker.configureDeposit(10, 0, { value: oneEther })

      await expectRevert(
        locker.increaseMinExpectedPrice(10, DEPOSIT_ID),
        "not configured"
      )
    })
  })
})
