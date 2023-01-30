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

describe("SmartHoldERC20", () => {
  const value = ethers.utils.parseEther("1")
  const lockForDays = 5
  let tokenA;
  let tokenETH;
  let smartHold;
  let priceFeed;
  let owner
  let notOwner

  const setup = async (opts) => {
    owner = (await ethers.getSigners())[0]
    notOwner = (await ethers.getSigners())[1]
    opts.priceFeedContract = opts.priceFeedContract || "PriceFeedMock"

    const PriceFeedMock = await ethers.getContractFactory(opts.priceFeedContract);
    const SmartHoldERC20 = await ethers.getContractFactory("SmartHoldERC20");
    const MockTokenA = await ethers.getContractFactory("MockTokenA");
    const MockETHTokenB = await ethers.getContractFactory("MockETHTokenB");

    priceFeed = await PriceFeedMock.deploy(opts.currentPrice * 10e7)
    smartHold = await SmartHoldERC20.deploy()
    tokenA = await MockTokenA.connect(notOwner).deploy()
    tokenETH = await MockETHTokenB.connect(notOwner).deploy()
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
    assert.ok(smartHold.address)
  })

  it("can hold both ETH and ERC20 tokens", async () => {
    await owner.sendTransaction({ value: value, to: smartHold.address })

    const balanceETH = await ethers.provider.getBalance(smartHold.address)
    expect(balanceETH).to.equal(value)

    await tokenA.connect(notOwner).transfer(smartHold.address, 250)
    const balanceA = await tokenA.balanceOf(smartHold.address)
    expect(balanceA).to.equal(250)
  })

  describe("'configureToken'", async () => {
    it("adds token data", async () => {
      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const lockTimeA = await smartHold.getLockForDaysDuration(tokenA.address)
      const tokenAddressA = await smartHold.tokenAddresses(0)
      expect(tokenAddressA).to.equal(tokenA.address)
      const pricePrecision = await smartHold.getPricePrecision(tokenA.address)
      expect(pricePrecision).to.equal(10e7)

      const count = (await smartHold.getConfiguredTokens()).length
      expect(count).to.equal(1)

      await expectRevert(
        smartHold.getLockForDaysDuration(tokenETH.address)
      , "not configured")
    })

    it("does not allow adding token more than once", async () => {
      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)

      await expectRevert(
        smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      , "already configured")
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(
        smartHold.configureToken(tokenA.address, 20, tokenA.address, 150, 10e7)
      , "revert")
    })

    it("enables 'getPrice' for a given token and saves minimumExpectedPrice", async () => {
      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const expectedPriceA = await smartHold.getMinExpectedPrice(tokenA.address)
      expect(expectedPriceA).to.equal(150)

      const currentPriceA = await smartHold.getPrice(tokenA.address)
      expect(currentPriceA).to.equal(100)

      await expectRevert(
        smartHold.getPrice(tokenETH.address)
      , "not configured")
    })

    it("checks that ignoring the minimum price is correctly configured", async () => {
      await expectRevert(
        smartHold.configureToken(tokenA.address, 20, priceFeed.address, 0, 10e7)
      , "Invalid")
    })

    it("does not allow setting negative expected price", async () => {
      await expectRevert(
        smartHold.configureToken(tokenA.address, 20, priceFeed.address, -10, 10e7)
      , "Invalid")
    })
  })

  describe("'increaseMinExpectedPrice'", async () => {
    beforeEach(async() => {
      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        smartHold.connect(notOwner).increaseMinExpectedPrice(tokenA.address, 50)
      , "Access denied")
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        smartHold.increaseMinExpectedPrice(tokenETH.address, 25)
      , "not configured")
    })

    it("does not allow decreasing the expected price", async () => {
      await expectRevert(
        smartHold.increaseMinExpectedPrice(tokenA.address, 120)
      , "invalid")
    })

    it("allows increasing the min expected price", async () => {
      await smartHold.increaseMinExpectedPrice(tokenA.address, 170)
      const newPrice = await smartHold.getMinExpectedPrice(tokenA.address)
      expect(newPrice).to.equal(170)
    })

    it("does not allow changing price if previously set to 0", async () => {
      await smartHold.configureToken(tokenETH.address, 10, constants.ZERO_ADDRESS, 0, 10e7)

      await expectRevert(
        smartHold.increaseMinExpectedPrice(tokenETH.address, 20)
      , "not configured")
    })
  })

  describe("'increaseLockForDays'", async () => {
    beforeEach(async() => {
      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        smartHold.connect(notOwner).increaseLockForDays(tokenA.address, 25)
      , "Access denied")
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        smartHold.increaseLockForDays(tokenETH.address, 25)
      , "not configured")
    })

    it("does not allow decreasing the lock duration", async () => {
      await expectRevert(
        smartHold.increaseLockForDays(tokenA.address, 15)
      , "invalid")
    })

    it("allows increasing the lock duration", async () => {
      await smartHold.increaseLockForDays(tokenA.address, 25)
      const newPrice = await smartHold.getLockForDaysDuration(tokenA.address)
      expect(newPrice).to.equal(25)
    })
  })

  describe("'checkPriceFeed'", async () => {
    it("returns current price for valid price feeds", async () => {
      const priceInDollars = await smartHold.checkPriceFeed(priceFeed.address, 10e7)
      expect(priceInDollars).to.equal(100)

      const priceInCents = await smartHold.checkPriceFeed(priceFeed.address, 10e5)
      expect(priceInCents).to.equal(10000)
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(
        smartHold.checkPriceFeed(tokenA.address, 10e7),
        "revert"
      )
    })
  })

  describe("'canWithdraw'", async () => {
    it("token was not configured it raises an error", async () => {
      await expectRevert(
        smartHold.canWithdraw(tokenA.address)
      , "not configured")

      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const result = await smartHold.canWithdraw(tokenA.address)
      expect(result).to.equal(false)
    })

    it("time for holding the token has passed it returns true", async () => {
      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      await advanceByDays(21)
      const result = await smartHold.canWithdraw(tokenA.address)
      expect(result).to.equal(true)
    })

    describe("price conditions", async () => {
      beforeEach(async () => {
        await setup(
          { currentPrice: 200, lockForDays: lockForDays }
        )
      })

      it("minimumExpectedPrice has been configured and is lower than the current price it returns true", async () => {
        await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
        const result = await smartHold.canWithdraw(tokenA.address)
        expect(result).to.equal(true)
      })

      it("minimumExpectedPrice has been configured and is higher than the current price it returns false", async () => {
        await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 210, 10e7)
        const result = await smartHold.canWithdraw(tokenA.address)
        expect(result).to.equal(false)
      })

      it("minimumExpectedPrice has not been configured it returns false", async () => {
        await smartHold.configureToken(tokenA.address, 20, constants.ZERO_ADDRESS, 0, 10e7)
        const result = await smartHold.canWithdraw(tokenA.address)
        expect(result).to.equal(false)
      })
    })
  })

  describe("'getConfiguredTokens'", async () => {
    it("returns array of token addresses", async () => {
      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 120, 10e7)
      await smartHold.configureToken(tokenETH.address, 20, constants.ZERO_ADDRESS, 0, 10e7)

      const tokens = await smartHold.getConfiguredTokens()
      expect(tokens[0]).to.equal(tokenA.address)
      expect(tokens[1]).to.equal(tokenETH.address)
      expect(tokens.length).to.equal(2)
    })
  })

  describe("'withdraw'", async () => {
    beforeEach(async() => {
      await smartHold.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        smartHold.connect(notOwner).withdraw(tokenA.address)
      , "Access denied")
    })

    it("raises an error if conditions are not fulfilled", async () => {
      await expectRevert(
        smartHold.withdraw(tokenA.address)
      , "cannot withdraw")
    })

    it("sends ERC20 tokens to owner account if conditions are fulfilled", async () => {
      const balanceBefore = await tokenA.balanceOf(owner.address)
      expect(balanceBefore).to.equal(0)
      await tokenA.connect(notOwner).transfer(smartHold.address, 500)

      await advanceByDays(21)

      await smartHold.withdraw(tokenA.address)
      const balanceAfter = await tokenA.balanceOf(owner.address)

      expect(balanceAfter).to.equal(500)
    })

    it("sends ETH tokens to owner account if conditions are fulfilled", async () => {
      await smartHold.configureToken(constants.ZERO_ADDRESS, 20, priceFeed.address, 150, 10e7)
      await notOwner.sendTransaction({ value: value, to: smartHold.address })

      await advanceByDays(21)

      await expect(smartHold.withdraw(constants.ZERO_ADDRESS)).to.changeEtherBalances(
        [owner, smartHold],
        [value, value.mul(-1)]
      );
    })
  })
})
