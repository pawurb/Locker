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

describe("ERC20Locker", () => {
  const value = ethers.utils.parseEther("1")
  const lockForDays = 5
  let tokenA;
  let tokenB;
  let locker;
  let priceFeed;
  let user1
  let user2

  const setup = async (opts) => {
    user1 = (await ethers.getSigners())[0]
    user2 = (await ethers.getSigners())[1]
    opts.priceFeedContract = opts.priceFeedContract || "PriceFeedMock"

    const PriceFeedMock = await ethers.getContractFactory(opts.priceFeedContract);
    const ERC20Locker = await ethers.getContractFactory("ERC20Locker");
    const MockERC20A = await ethers.getContractFactory("MockERC20A");
    const MockERC20B = await ethers.getContractFactory("MockERC20B");

    priceFeed = await PriceFeedMock.deploy(opts.currentPrice * 10e7)
    locker = await ERC20Locker.deploy()
    tokenA = await MockERC20A.deploy()
    tokenB = await MockERC20B.deploy()
  }

  beforeEach(async () => {
    await setup(
      { currentPrice: 100, lockForDays: lockForDays }
    )
  })

  describe("tokens", async () => {
    it("are correctly created", async () => {
      const balanceA = await tokenA.balanceOf(user1.address)
      expect(balanceA).to.equal(1000)

      const balanceB = await tokenB.balanceOf(user1.address)
      expect(balanceB).to.equal(2000)
    })
  })

  it("can be deployed", async () => {
    assert.ok(locker.address)
  })

  it("does not accept direct transfers of ETH", async () => {
    await expectRevert(
      user1.sendTransaction({ value: value, to: locker.address })
    , "cannot estimate gas")
  })

  describe("'configureDeposit'", async () => {
    it("adds token data for the correct user without price conditions", async () => {
      await locker.configureDeposit(tokenA.address, 20)
      const depositData = await locker.deposits(user1.address, tokenA.address)
      expect(depositData.lockForDays).to.equal(20)
      expect(depositData.minExpectedPrice).to.equal(0)
      expect(depositData.pricePrecision).to.equal(0)
      expect(depositData.priceFeed).to.equal(constants.ZERO_ADDRESS)
      expect(depositData.balance).to.equal(0)
      const firstDepositor = await locker.depositors(0)
      expect(firstDepositor).to.equal(user1.address)
    })
  })

  describe("'configureDepositWithPrice'", async () => {
    it("adds token data for the correct user", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)

      const depositData = await locker.deposits(user1.address, tokenA.address)
      expect(depositData.lockForDays).to.equal(20)
      expect(depositData.minExpectedPrice).to.equal(150)
      expect(depositData.pricePrecision).to.equal(10e7)
      expect(depositData.priceFeed).to.equal(priceFeed.address)
      expect(depositData.balance).to.equal(0)
      const firstDepositor = await locker.depositors(0)
      expect(firstDepositor).to.equal(user1.address)
    })

    it("does not duplicate depositor address", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
      await locker.configureDepositWithPrice(tokenB.address, 20, priceFeed.address, 150, 10e7)

      const firstDepositor = await locker.depositors(0)
      expect(firstDepositor).to.equal(user1.address)

      await expectRevert(
        locker.depositors(1)
      , "revert")

      const depositors = await locker.getDepositors()
      expect(depositors.length).to.equal(1)
    })

    it("does not allow adding token more than once", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)

      await expectRevert(
        locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
      , "already configured")
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(
        locker.configureDepositWithPrice(tokenA.address, 20, tokenA.address, 150, 10e7)
      , "revert")
    })

    it("raises an error for invalid lockForDays value", async () => {
      await expectRevert(
        locker.configureDepositWithPrice(tokenA.address, 0, tokenA.address, 150, 10e7)
      , "Invalid lockForDays value")
    })

    it("enables 'getPrice' for a given token and saves minimumExpectedPrice", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)

      const depositData = await locker.deposits(user1.address, tokenA.address)
      expect(depositData.minExpectedPrice).to.equal(150)

      const currentPriceA = await locker.getPrice(user1.address, tokenA.address)
      expect(currentPriceA).to.equal(100)

      await expectRevert(
        locker.getPrice(user1.address, tokenB.address)
      , "not configured")
    })

    it("checks that disabling the minimum price is only possible for zero address price oracle", async () => {
      await expectRevert(
        locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 0, 10e7)
      , "Invalid")

      locker.configureDepositWithPrice(tokenA.address, 20, constants.ZERO_ADDRESS, 0, 10e7)

      const currentPriceA = await locker.getPrice(user1.address, tokenA.address)
      expect(currentPriceA).to.equal(0)
    })

    it("does not allow setting negative expected price", async () => {
      await expectRevert(
        locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, -10, 10e7)
      , "Invalid")
    })
  })

  describe("'canWithdraw'", async () => {
    it("token was not configured it raises an error", async () => {
      await expectRevert(
        locker.canWithdraw(user1.address, tokenA.address)
      , "not configured")

      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const result = await locker.canWithdraw(user1.address, tokenA.address)
      expect(result).to.equal(false)
    })

    it("time for holding the token has passed it returns true", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
      await advanceByDays(21)
      const result = await locker.connect(user2).canWithdraw(user1.address, tokenA.address)
      expect(result).to.equal(true)
    })

    it("time for holding the token has passed it returns false for other user", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
      await locker.connect(user2).configureDepositWithPrice(tokenA.address, 30, priceFeed.address, 150, 10e7)
      await advanceByDays(21)
      const result = await locker.connect(user2).canWithdraw(user2.address, tokenA.address)
      expect(result).to.equal(false)
    })

    describe("price conditions", async () => {
      beforeEach(async () => {
        await setup(
          { currentPrice: 200, lockForDays: lockForDays }
        )
      })

      it("minimumExpectedPrice has been configured and is lower than the current price it returns true", async () => {
        await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
        const result = await locker.canWithdraw(user1.address, tokenA.address)
        expect(result).to.equal(true)
      })

      it("minimumExpectedPrice has been configured and is higher than the current price it returns false", async () => {
        await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 210, 10e7)
        const result = await locker.canWithdraw(user1.address, tokenA.address)
        expect(result).to.equal(false)
      })

      it("minimumExpectedPrice has not been configured it returns false", async () => {
        await locker.configureDepositWithPrice(tokenA.address, 20, constants.ZERO_ADDRESS, 0, 10e7)
        const result = await locker.canWithdraw(user1.address, tokenA.address)
        expect(result).to.equal(false)
      })
    })
  })

  describe("'deposit'", async () => {
    it("transfers the correct amount of token to locker and updates balance", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, constants.ZERO_ADDRESS, 0, 10e7)
      const balanceBefore = await tokenA.balanceOf(user1.address)
      expect(balanceBefore).to.equal(1000)

      await tokenA.approve(locker.address, 50);
      const approvedAmountA = await tokenA.allowance(user1.address, locker.address)
      expect(approvedAmountA).to.equal(50)

      await expect(locker.deposit(tokenA.address, 20))
      .to.changeTokenBalances(
        tokenA,
        [locker.address, user1.address],
        [20, -20]
      )

      await expect(locker.deposit(tokenA.address, 10))
      .to.changeTokenBalances(
        tokenA,
        [locker.address, user1.address],
        [10, -10]
      )

      const approvedAmountB = await tokenA.allowance(user1.address, locker.address)
      expect(approvedAmountB).to.equal(20)
    })
  });

  describe("'withdraw'", async () => {
    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.withdraw(tokenA.address)
      , "not configured")
    })

    it("returns correct amount of token only when withdrawal conditions are correct", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
      await tokenA.approve(locker.address, 50);
      await locker.deposit(tokenA.address, 50);

      await expectRevert(
        locker.withdraw(tokenA.address)
      , "cannot withdraw")

      await advanceByDays(30)

      await expect(locker.withdraw(tokenA.address))
      .to.changeTokenBalances(
        tokenA,
        [locker.address, user1.address],
        [-50, 50]
      )

      const depositData = await locker.deposits(user1.address, tokenA.address)
      expect(depositData.balance).to.equal(0)
    })

    it("does not affect balances of other users", async () => {
      await locker.configureDeposit(tokenA.address, 20)
      await tokenA.approve(locker.address, 50);
      await locker.deposit(tokenA.address, 50);
      await tokenA.transfer(user2.address, 30);

      await locker.connect(user2).configureDeposit(tokenA.address, 30)
      await tokenA.connect(user2).approve(locker.address, 30);
      await locker.connect(user2).deposit(tokenA.address, 30);

      await advanceByDays(25)

      await expectRevert(
        locker.connect(user2).withdraw(tokenA.address),
        "cannot withdraw"
      )

      await expect(locker.withdraw(tokenA.address))
      .to.changeTokenBalances(
        tokenA,
        [locker.address, user1.address],
        [-50, 50]
      )

      const depositData1 = await locker.deposits(user1.address, tokenA.address)
      expect(depositData1.balance).to.equal(0)

      const depositData2 = await locker.deposits(user2.address, tokenA.address)
      expect(depositData2.balance).to.equal(30)
    })
  })

  describe("'increaseMinExpectedPrice'", async () => {
    beforeEach(async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.increaseMinExpectedPrice(tokenB.address, 25)
      , "not configured")
    })

    it("does not allow decreasing the expected price", async () => {
      await expectRevert(
        locker.increaseMinExpectedPrice(tokenA.address, 120)
      , "invalid")
    })

    it("allows increasing the min expected price", async () => {
      await locker.increaseMinExpectedPrice(tokenA.address, 170)
      const depositData = await locker.deposits(user1.address, tokenA.address)
      expect(depositData.minExpectedPrice).to.equal(170)
    })

    it("does not allow changing price if previously set to 0", async () => {
      await locker.configureDeposit(tokenB.address, 10)

      await expectRevert(
        locker.increaseMinExpectedPrice(tokenB.address, 20)
      , "not configured")
    })
  })

  describe("'increaseLockForDays'", async () => {
    beforeEach(async() => {
      await locker.configureDeposit(tokenA.address, 20)
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.increaseLockForDays(tokenB.address, 25)
      , "not configured")
    })

    it("does not allow decreasing the lock duration", async () => {
      await expectRevert(
        locker.increaseLockForDays(tokenA.address, 15)
      , "invalid")
    })

    it("allows increasing the lock duration", async () => {
      await locker.increaseLockForDays(tokenA.address, 25)

      const depositData = await locker.deposits(user1.address, tokenA.address)
      expect(depositData.lockForDays).to.equal(25)
    })
  })

  describe("'checkPriceFeed'", async () => {
    it("returns current price for valid price feeds", async () => {
      const priceInDollars = await locker.checkPriceFeed(priceFeed.address, 10e7)
      expect(priceInDollars).to.equal(100)

      const priceInCents = await locker.checkPriceFeed(priceFeed.address, 10e5)
      expect(priceInCents).to.equal(10000)
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(
        locker.checkPriceFeed(tokenA.address, 10e7),
        "revert"
      )
    })
  })

  describe("'getDepositors'", async () => {
    it("returns array of configured addresses", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
      await locker.connect(user2).configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)

      const depositors = await locker.getDepositors()
      expect(depositors[0]).to.equal(user1.address)
      expect(depositors[1]).to.equal(user2.address)
      expect(depositors.length).to.equal(2)
    })
  })

  describe("'getConfiguredTokens'", async () => {
    it("returns array of tokens configured for account ", async () => {
      await locker.configureDepositWithPrice(tokenA.address, 20, priceFeed.address, 150, 10e7)
      await locker.configureDepositWithPrice(tokenB.address, 20, priceFeed.address, 150, 10e7)

      const tokens = await locker.getConfiguredTokens(user1.address)
      expect(tokens.length).to.equal(2)
      expect(tokens[0]).to.equal(tokenA.address)
      expect(tokens[1]).to.equal(tokenB.address)
    })
  })
})
