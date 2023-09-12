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

const DEPOSIT_ID = 0

describe("ERC20Locker", () => {
  const value = ethers.parseEther("1")
  const lockForDays = 5
  let tokenA
  let tokenB
  let locker
  let lockerPass
  let priceFeed
  let user1
  let user2

  const setup = async (opts) => {
    user1 = (await ethers.getSigners())[0]
    user2 = (await ethers.getSigners())[1]
    opts.priceFeedContract = opts.priceFeedContract || "PriceFeedMock"

    const PriceFeedMock = await ethers.getContractFactory(
      opts.priceFeedContract
    )
    const ERC20Locker = await ethers.getContractFactory("ERC20Locker")
    const MockERC20A = await ethers.getContractFactory("MockERC20A")
    const MockERC20B = await ethers.getContractFactory("MockERC20B")

    priceFeed = await PriceFeedMock.deploy(opts.currentPrice * 10e7)
    locker = await ERC20Locker.deploy()
    let lockerPassAddress = await locker.lockerPass()
    lockerPass = await ethers.getContractAt(
      "contracts/LockerPass.sol:LockerPass",
      lockerPassAddress
    )

    tokenA = await MockERC20A.deploy()
    tokenB = await MockERC20B.deploy()
  }

  beforeEach(async () => {
    await setup({ currentPrice: 100, lockForDays: lockForDays })
  })

  describe("mock ERC20 tokens", async () => {
    it("are correctly created", async () => {
      const balanceA = await tokenA.balanceOf(user1.address)
      expect(balanceA).to.equal(1000)

      const balanceB = await tokenB.balanceOf(user1.address)
      expect(balanceB).to.equal(2000)
    })
  })

  it("can be deployed", async () => {
    assert.ok(locker.target)
  })

  it("does not accept direct transfers of ETH", async () => {
    await expectRevert(
      user1.sendTransaction({ value: value, to: locker.target }),
      "Transaction reverted"
    )
  })

  it("deploys ERC20LockerPass instance and sets itself as an admin", async () => {
    expect(await lockerPass.admin()).to.equal(locker.target)
    expect(await lockerPass.symbol()).to.equal("LOP")
  })

  describe("'configureDeposit'", async () => {
    it("adds token data for the correct user without price conditions", async () => {
      await locker.configureDeposit(tokenA.target, 20)
      let newDepositId = parseInt((await lockerPass.nextId())) - 1

      const depositData = await locker.deposits(newDepositId)
      expect(depositData.lockForDays).to.equal(20)
      expect(depositData.minExpectedPrice).to.equal(0)
      expect(depositData.pricePrecision).to.equal(0)
      expect(depositData.priceFeed).to.equal(constants.ZERO_ADDRESS)
      expect(depositData.balance).to.equal(0)
    })
  })

  describe("'configureDepositWithPrice'", async () => {
    it("adds token data for the correct user", async () => {
      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        150,
        10e7
      )
      let newDepositId = parseInt((await lockerPass.nextId())) - 1

      const depositData = await locker.deposits(newDepositId)
      expect(depositData.lockForDays).to.equal(20)
      expect(depositData.minExpectedPrice).to.equal(150)
      expect(depositData.pricePrecision).to.equal(10e7)
      expect(depositData.priceFeed).to.equal(priceFeed.target)
      expect(depositData.balance).to.equal(0)
    })

    it("does allows adding token more than once", async () => {
      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        150,
        10e7
      )

      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        140,
        10e7
      )
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(
        locker.configureDepositWithPrice(
          tokenA.target,
          20,
          tokenA.target,
          150,
          10e7
        ),
        "revert"
      )
    })

    it("raises an error for invalid lockForDays value", async () => {
      await expectRevert(
        locker.configureDepositWithPrice(
          tokenA.target,
          0,
          tokenA.target,
          150,
          10e7
        ),
        "Invalid lockForDays value"
      )
    })

    it("enables 'getPrice' for a given token and saves minimumExpectedPrice", async () => {
      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        150,
        10e7
      )
      let newDepositId = parseInt((await lockerPass.nextId())) - 1

      const depositData = await locker.deposits(newDepositId)
      expect(depositData.minExpectedPrice).to.equal(150)

      const currentPriceA = await locker.getPrice(newDepositId)
      expect(currentPriceA).to.equal(100)

      await expectRevert(locker.getPrice(newDepositId + 1), "not configured")
    })

    it("checks that disabling the minimum price is only possible for zero address price oracle", async () => {
      await expectRevert(
        locker.configureDepositWithPrice(
          tokenA.target,
          20,
          priceFeed.target,
          0,
          10e7
        ),
        "Invalid"
      )

      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        constants.ZERO_ADDRESS,
        0,
        10e7
      )
      let newDepositId = parseInt((await lockerPass.nextId())) - 1

      const currentPriceA = await locker.getPrice(newDepositId)
      expect(currentPriceA).to.equal(0)
    })

    it("does not allow setting negative expected price", async () => {
      await expectRevert(
        locker.configureDepositWithPrice(
          tokenA.target,
          20,
          priceFeed.target,
          -10,
          10e7
        ),
        "Invalid"
      )
    })
  })

  describe("'canWithdraw'", async () => {
    it("token was not configured it raises an error", async () => {
      await expectRevert(locker.canWithdraw(DEPOSIT_ID), "not configured")

      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        150,
        10e7
      )
      const result = await locker.canWithdraw(DEPOSIT_ID)
      expect(result).to.equal(false)
    })

    it("time for holding the token has passed it returns true", async () => {
      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        150,
        10e7
      )
      await advanceByDays(21)
      const result = await locker.connect(user2).canWithdraw(DEPOSIT_ID)
      expect(result).to.equal(true)
    })

    it("time for holding the token has passed it returns true for other user", async () => {
      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        150,
        10e7
      )
      await locker
        .connect(user2)
        .configureDepositWithPrice(
          tokenA.target,
          30,
          priceFeed.target,
          150,
          10e7
        )
      await advanceByDays(21)
      const result = await locker.connect(user2).canWithdraw(DEPOSIT_ID + 1)
      expect(result).to.equal(false)
    })

    describe("price conditions", async () => {
      beforeEach(async () => {
        await setup({ currentPrice: 200, lockForDays: lockForDays })
      })

      it("minimumExpectedPrice has been configured and is lower than the current price it returns true", async () => {
        await locker.configureDepositWithPrice(
          tokenA.target,
          20,
          priceFeed.target,
          150,
          10e7
        )
        const result = await locker.canWithdraw(DEPOSIT_ID)
        expect(result).to.equal(true)
      })

      it("minimumExpectedPrice has been configured and is higher than the current price it returns false", async () => {
        await locker.configureDepositWithPrice(
          tokenA.target,
          20,
          priceFeed.target,
          210,
          10e7
        )
        const result = await locker.canWithdraw(DEPOSIT_ID)
        expect(result).to.equal(false)
      })

      it("minimumExpectedPrice has not been configured it returns false", async () => {
        await locker.configureDepositWithPrice(
          tokenA.target,
          20,
          constants.ZERO_ADDRESS,
          0,
          10e7
        )
        const result = await locker.canWithdraw(DEPOSIT_ID)
        expect(result).to.equal(false)
      })
    })
  })

  describe("'deposit'", async () => {
    it("transfers the correct amount of token to locker and updates balance", async () => {
      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        constants.ZERO_ADDRESS,
        0,
        10e7
      )
      const balanceBefore = await tokenA.balanceOf(user1.address)
      expect(balanceBefore).to.equal(1000)

      await tokenA.approve(locker.target, 50)
      const approvedAmountA = await tokenA.allowance(
        user1.address,
        locker.target
      )
      expect(approvedAmountA).to.equal(50)

      await expect(
        locker.deposit(tokenA.target, 20, DEPOSIT_ID)
      ).to.changeTokenBalances(
        tokenA,
        [locker.target, user1.address],
        [20, -20]
      )

      await expect(
        locker.deposit(tokenA.target, 10, DEPOSIT_ID)
      ).to.changeTokenBalances(
        tokenA,
        [locker.target, user1.address],
        [10, -10]
      )

      const approvedAmountB = await tokenA.allowance(
        user1.address,
        locker.target
      )
      expect(approvedAmountB).to.equal(20)
    })
  })

  describe("'withdraw'", async () => {
    it("raises an error for not configured tokens", async () => {
      await expectRevert(locker.withdraw(DEPOSIT_ID), "Access denied")
    })

    it("returns correct amount of token only when withdrawal conditions are correct", async () => {
      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        150,
        10e7
      )
      await tokenA.approve(locker.target, 50)
      await locker.deposit(tokenA.target, 50, DEPOSIT_ID)

      await expectRevert(locker.withdraw(DEPOSIT_ID), "cannot withdraw")

      await advanceByDays(30)

      await expect(locker.withdraw(DEPOSIT_ID)).to.changeTokenBalances(
        tokenA,
        [locker.target, user1.address],
        [-50, 50]
      )

      const depositData = await locker.deposits(DEPOSIT_ID)
      expect(depositData.balance).to.equal(0)
    })

    it("does not affect balances of other users", async () => {
      await locker.configureDeposit(tokenA.target, 20)
      await tokenA.approve(locker.target, 50)
      await locker.deposit(tokenA.target, 50, DEPOSIT_ID)
      await tokenA.transfer(user2.address, 30)

      await locker.connect(user2).configureDeposit(tokenA.target, 30)
      await tokenA.connect(user2).approve(locker.target, 30)
      await locker.connect(user2).deposit(tokenA.target, 30, DEPOSIT_ID + 1)

      await advanceByDays(25)

      await expectRevert(
        locker.connect(user2).withdraw(DEPOSIT_ID + 1),
        "cannot withdraw"
      )

      await expect(locker.withdraw(DEPOSIT_ID)).to.changeTokenBalances(
        tokenA,
        [locker.target, user1.address],
        [-50, 50]
      )

      const depositData1 = await locker.deposits(DEPOSIT_ID)
      expect(depositData1.balance).to.equal(0)

      const depositData2 = await locker.deposits(DEPOSIT_ID + 1)
      expect(depositData2.balance).to.equal(30)
    })

    it("burns the correct LockerPass NFT", async () => {
      await locker.configureDeposit(tokenA.target, 20)
      await tokenA.approve(locker.target, 50)
      await locker.deposit(tokenA.target, 50, DEPOSIT_ID)
      await advanceByDays(21)

      await expect(locker.withdraw(DEPOSIT_ID)).to.changeTokenBalances(
        lockerPass,
        [user1],
        [-1]
      )
    })
  })

  describe("'increaseMinExpectedPrice'", async () => {
    beforeEach(async () => {
      await locker.configureDepositWithPrice(
        tokenA.target,
        20,
        priceFeed.target,
        150,
        10e7
      )
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.increaseMinExpectedPrice(25, DEPOSIT_ID + 1),
        "Access denied"
      )
    })

    it("does not allow decreasing the expected price", async () => {
      await expectRevert(
        locker.increaseMinExpectedPrice(120, DEPOSIT_ID),
        "invalid"
      )
    })

    it("allows increasing the min expected price", async () => {
      await locker.increaseMinExpectedPrice(170, DEPOSIT_ID)
      const depositData = await locker.deposits(DEPOSIT_ID)
      expect(depositData.minExpectedPrice).to.equal(170)
    })

    it("does not allow changing price if previously set to 0", async () => {
      await locker.configureDeposit(tokenB.target, 10)

      await expectRevert(
        locker.increaseMinExpectedPrice(20, DEPOSIT_ID),
        "value invalid"
      )
    })
  })

  describe("'increaseLockForDays'", async () => {
    beforeEach(async () => {
      await locker.configureDeposit(tokenA.target, 20)
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.increaseLockForDays(25, DEPOSIT_ID + 1),
        "Access denied"
      )
    })

    it("does not allow decreasing the lock duration", async () => {
      await expectRevert(locker.increaseLockForDays(15, DEPOSIT_ID), "invalid")
    })

    it("allows increasing the lock duration", async () => {
      await locker.increaseLockForDays(25, DEPOSIT_ID)

      const depositData = await locker.deposits(DEPOSIT_ID)
      expect(depositData.lockForDays).to.equal(25)
    })
  })

  describe("'checkPriceFeed'", async () => {
    it("returns current price for valid price feeds", async () => {
      const priceInDollars = await locker.checkPriceFeed(
        priceFeed.target,
        10e7
      )
      expect(priceInDollars).to.equal(100)

      const priceInCents = await locker.checkPriceFeed(priceFeed.target, 10e5)
      expect(priceInCents).to.equal(10000)
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(locker.checkPriceFeed(tokenA.target, 10e7), "revert")
    })
  })
})
