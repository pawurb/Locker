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

describe("ERC20LockerPriv", () => {
  const value = ethers.utils.parseEther("1")
  const lockForDays = 5
  let tokenA;
  let tokenETH;
  let locker;
  let priceFeed;
  let owner
  let notOwner

  const setup = async (opts) => {
    owner = (await ethers.getSigners())[0]
    notOwner = (await ethers.getSigners())[1]
    opts.priceFeedContract = opts.priceFeedContract || "PriceFeedMock"

    const PriceFeedMock = await ethers.getContractFactory(opts.priceFeedContract);
    const ERC20LockerPriv = await ethers.getContractFactory("ERC20LockerPriv");
    const MockERC20A = await ethers.getContractFactory("MockERC20A");
    const MockERC20B = await ethers.getContractFactory("MockERC20B");

    priceFeed = await PriceFeedMock.deploy(opts.currentPrice * 10e7)
    locker = await ERC20LockerPriv.deploy()
    tokenA = await MockERC20A.connect(notOwner).deploy()
    tokenETH = await MockERC20B.connect(notOwner).deploy()
  }

  beforeEach(async () => {
    await setup(
      { currentPrice: 100, lockForDays: lockForDays }
    )
  })

  describe("tokens", async () => {
    it("are correctly created", async () => {
      const balanceA = await tokenA.balanceOf(notOwner.address)
      expect(balanceA).to.equal(1000)

      const balanceB = await tokenETH.balanceOf(notOwner.address)
      expect(balanceB).to.equal(2000)
    })
  })

  it("can be deployed", async () => {
    assert.ok(locker.address)
  })

  it("can hold only ERC20 tokens", async () => {
    await expectRevert(
      owner.sendTransaction({ value: value, to: locker.address })
    , "transaction may fail")

    await tokenA.connect(notOwner).transfer(locker.address, 250)
    const balanceA = await tokenA.balanceOf(locker.address)
    expect(balanceA).to.equal(250)
  })

  describe("'configureToken'", async () => {
    it("adds token data", async () => {
      await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const depositData = await locker.deposits(tokenA.address)
      expect(depositData.lockForDays).to.equal(20)
      const tokenAddressA = await locker.tokenAddresses(0)
      expect(tokenAddressA).to.equal(tokenA.address)
      expect(depositData.pricePrecision).to.equal(10e7)

      const count = (await locker.getConfiguredTokens()).length
      expect(count).to.equal(1)
    })

    it("does not allow adding token more than once", async () => {
      await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)

      await expectRevert(
        locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      , "already configured")
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(
        locker.configureToken(tokenA.address, 20, tokenA.address, 150, 10e7)
      , "revert")
    })

    it("enables 'getPrice' for a given token and saves minimumExpectedPrice", async () => {
      await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const expectedPriceA = (await locker.deposits(tokenA.address)).minExpectedPrice
      expect(expectedPriceA).to.equal(150)

      const currentPriceA = await locker.getPrice(tokenA.address)
      expect(currentPriceA).to.equal(100)

      await expectRevert(
        locker.getPrice(tokenETH.address)
      , "not configured")
    })

    it("checks that ignoring the minimum price is correctly configured", async () => {
      await expectRevert(
        locker.configureToken(tokenA.address, 20, priceFeed.address, 0, 10e7)
      , "Invalid")
    })

    it("does not allow setting negative expected price", async () => {
      await expectRevert(
        locker.configureToken(tokenA.address, 20, priceFeed.address, -10, 10e7)
      , "Invalid")
    })
  })

  describe("'increaseMinExpectedPrice'", async () => {
    beforeEach(async() => {
      await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        locker.connect(notOwner).increaseMinExpectedPrice(tokenA.address, 50)
      , "Access denied")
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.increaseMinExpectedPrice(tokenETH.address, 25)
      , "not configured")
    })

    it("does not allow decreasing the expected price", async () => {
      await expectRevert(
        locker.increaseMinExpectedPrice(tokenA.address, 120)
      , "invalid")
    })

    it("allows increasing the min expected price", async () => {
      await locker.increaseMinExpectedPrice(tokenA.address, 170)
      const newPrice = (await locker.deposits(tokenA.address)).minExpectedPrice
      expect(newPrice).to.equal(170)
    })

    it("does not allow changing price if previously set to 0", async () => {
      await locker.configureToken(tokenETH.address, 10, constants.ZERO_ADDRESS, 0, 10e7)

      await expectRevert(
        locker.increaseMinExpectedPrice(tokenETH.address, 20)
      , "not configured")
    })
  })

  describe("'increaseLockForDays'", async () => {
    beforeEach(async() => {
      await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        locker.connect(notOwner).increaseLockForDays(tokenA.address, 25)
      , "Access denied")
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        locker.increaseLockForDays(tokenETH.address, 25)
      , "not configured")
    })

    it("does not allow decreasing the lock duration", async () => {
      await expectRevert(
        locker.increaseLockForDays(tokenA.address, 15)
      , "invalid")
    })

    it("allows increasing the lock duration", async () => {
      await locker.increaseLockForDays(tokenA.address, 25)
      const newDuration = (await locker.deposits(tokenA.address)).lockForDays
      expect(newDuration).to.equal(25)
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

  describe("'canWithdraw'", async () => {
    it("token was not configured it raises an error", async () => {
      await expectRevert(
        locker.canWithdraw(tokenA.address)
      , "not configured")

      await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const result = await locker.canWithdraw(tokenA.address)
      expect(result).to.equal(false)
    })

    it("time for holding the token has passed it returns true", async () => {
      await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      await advanceByDays(21)
      const result = await locker.canWithdraw(tokenA.address)
      expect(result).to.equal(true)
    })

    describe("price conditions", async () => {
      beforeEach(async () => {
        await setup(
          { currentPrice: 200, lockForDays: lockForDays }
        )
      })

      it("minimumExpectedPrice has been configured and is lower than the current price it returns true", async () => {
        await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
        const result = await locker.canWithdraw(tokenA.address)
        expect(result).to.equal(true)
      })

      it("minimumExpectedPrice has been configured and is higher than the current price it returns false", async () => {
        await locker.configureToken(tokenA.address, 20, priceFeed.address, 210, 10e7)
        const result = await locker.canWithdraw(tokenA.address)
        expect(result).to.equal(false)
      })

      it("minimumExpectedPrice has not been configured it returns false", async () => {
        await locker.configureToken(tokenA.address, 20, constants.ZERO_ADDRESS, 0, 10e7)
        const result = await locker.canWithdraw(tokenA.address)
        expect(result).to.equal(false)
      })
    })
  })

  describe("'getConfiguredTokens'", async () => {
    it("returns array of token addresses", async () => {
      await locker.configureToken(tokenA.address, 20, priceFeed.address, 120, 10e7)
      await locker.configureToken(tokenETH.address, 20, constants.ZERO_ADDRESS, 0, 10e7)

      const tokens = await locker.getConfiguredTokens()
      expect(tokens[0]).to.equal(tokenA.address)
      expect(tokens[1]).to.equal(tokenETH.address)
      expect(tokens.length).to.equal(2)
    })
  })

  describe("'withdraw'", async () => {
    beforeEach(async() => {
      await locker.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        locker.connect(notOwner).withdraw(tokenA.address)
      , "Access denied")
    })

    it("raises an error if conditions are not fulfilled", async () => {
      await expectRevert(
        locker.withdraw(tokenA.address)
      , "cannot withdraw")
    })

    it("sends ERC20 tokens to owner account if conditions are fulfilled", async () => {
      const balanceBefore = await tokenA.balanceOf(owner.address)
      expect(balanceBefore).to.equal(0)
      await tokenA.connect(notOwner).transfer(locker.address, 500)

      await advanceByDays(21)

      await locker.withdraw(tokenA.address)
      const balanceAfter = await tokenA.balanceOf(owner.address)

      expect(balanceAfter).to.equal(500)
    })
  })
})
