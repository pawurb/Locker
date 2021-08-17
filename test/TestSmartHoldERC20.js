const Web3Utils = require('web3-utils')
const {
  accounts,
  contract,
  web3,
  defaultSender
} = require('@openzeppelin/test-environment')

const {
    BN,
    time,
    balance,
    constants,
    expectEvent,
    expectRevert,
    send,
    ether,
} = require('@openzeppelin/test-helpers')
const { assert, expect } = require('chai')

const SmartHoldERC20 = contract.fromArtifact("SmartHoldERC20")

const PriceFeedMock = contract.fromArtifact("PriceFeedMock")
const BuggyPriceFeedMock = contract.fromArtifact("BuggyPriceFeedMock")

const MockTokenA = contract.fromArtifact("MockTokenA")
const MockETHTokenB = contract.fromArtifact("MockETHTokenB")

const advanceByDays = async (days) => {
  await time.increase(days * 86400)
}

describe("SmartHoldERC20", async () => {
  const value = Web3Utils.toWei("0.01", "ether")
  const [notOwner] = accounts
  const owner = defaultSender
  let lockForDays = 5
  let deposit
  let priceFeed
  let tokenA
  let tokenETH

  const mockPrice = async (value) => {
    priceFeed = await PriceFeedMock.new(value * 10e7)
  }

  beforeEach(async() => {
    tokenA = await MockTokenA.new({from: notOwner})
    tokenETH = await MockETHTokenB.new({from: notOwner})
    deposit = await SmartHoldERC20.new()
    await mockPrice(100)
  })

  describe("tokens", async () => {
    it("are correctly created", async () => {
      const balanceA = await tokenA.balanceOf(notOwner)
      assert.equal(balanceA, 1000)

      const balanceB = await tokenETH.balanceOf(notOwner)
      assert.equal(balanceB, 2000)
    })
  })

  it("can be deployed", async () => {
    assert.ok(deposit.address)
  })

  it("can hold both ETH and ERC20 tokens", async () => {
    await send.ether(owner, deposit.address, ether('1'))

    const balanceETH = await balance.current(deposit.address, 'ether')
    assert.equal(balanceETH, 1)

    await tokenA.transfer(deposit.address, 250, {from: notOwner})
    const balanceA = await tokenA.balanceOf(deposit.address)
    assert.equal(balanceA, 250)
  })

  describe("'configureToken'", async () => {
    it("adds token data", async () => {
      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const lockTimeA = await deposit.getLockForDaysDuration(tokenA.address)
      const tokenAddressA = await deposit.tokenAddresses(0)
      assert.equal(tokenAddressA, tokenA.address)
      const pricePrecision = await deposit.getPricePrecision(tokenA.address)
      assert.equal(pricePrecision, 10e7)

      const count = (await deposit.getConfiguredTokens()).length
      assert.equal(count, 1)

      await expectRevert(
        deposit.getLockForDaysDuration(tokenETH.address)
      , "not configured")
    })

    it("does not allow adding token more than once", async () => {
      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)

      await expectRevert(
        deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      , "already configured")
    })

    it("does not allow locking funds for too long", async () => {
      await expectRevert(
        deposit.configureToken(tokenA.address, 4500, priceFeed.address, 150, 10e7)
      , "Too long")
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(
        deposit.configureToken(tokenA.address, 20, tokenA.address, 150, 10e7)
      , "revert")

    })

    it("enables 'getPrice' for a given token and saves minimumExpectedPrice", async () => {
      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const expectedPriceA = await deposit.getMinExpectedPrice(tokenA.address)
      assert.equal(expectedPriceA, 150)

      const currentPriceA = await deposit.getPrice(tokenA.address)
      assert.equal(currentPriceA, 100)

      await expectRevert(
        deposit.getPrice(tokenETH.address)
      , "not configured")
    })

    it("checks that ignoring the minimum price is correctly configured", async () => {
      await expectRevert(
        deposit.configureToken(tokenA.address, 20, priceFeed.address, 0, 10e7)
      , "Invalid")
    })

    it("does not allow setting negative expected price", async () => {
      await expectRevert(
        deposit.configureToken(tokenA.address, 20, priceFeed.address, -10, 10e7)
      , "Invalid")
    })
  })

  describe("'increaseMinExpectedPrice'", async () => {
    beforeEach(async() => {
      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        deposit.increaseMinExpectedPrice(tokenA.address, 50, {from: notOwner})
      , "Access denied")
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        deposit.increaseMinExpectedPrice(tokenETH.address, 25)
      , "not configured")
    })

    it("does not allow decreasing the expected price", async () => {
      await expectRevert(
        deposit.increaseMinExpectedPrice(tokenA.address, 120)
      , "invalid")
    })

    it("allows increasing the min expected price", async () => {
      await deposit.increaseMinExpectedPrice(tokenA.address, 170)
      const newPrice = await deposit.getMinExpectedPrice(tokenA.address)
      assert.equal(newPrice, 170)
    })
  })

  describe("'increaseLockForDays'", async () => {
    beforeEach(async() => {
      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        deposit.increaseLockForDays(tokenA.address, 25, {from: notOwner})
      , "Access denied")
    })

    it("raises an error for not configured tokens", async () => {
      await expectRevert(
        deposit.increaseLockForDays(tokenETH.address, 25)
      , "not configured")
    })

    it("does not allow decreasing the lock duration", async () => {
      await expectRevert(
        deposit.increaseLockForDays(tokenA.address, 15)
      , "invalid")
    })

    it("allows increasing the lock duration", async () => {
      await deposit.increaseLockForDays(tokenA.address, 25)
      const newPrice = await deposit.getLockForDaysDuration(tokenA.address)
      assert.equal(newPrice, 25)
    })
  })

  describe("'checkPriceFeed'", async () => {
    it("returns current price for valid price feeds", async () => {
      const priceInDollars = await deposit.checkPriceFeed(priceFeed.address, 10e7)
      assert.equal(priceInDollars, 100)

      const priceInCents = await deposit.checkPriceFeed(priceFeed.address, 10e5)
      assert.equal(priceInCents, 10000)
    })

    it("raises an error for invalid price feed addresses", async () => {
      await expectRevert(
        deposit.checkPriceFeed(tokenA.address, 10e7),
        "revert"
      )
    })
  })

  describe("'canWithdraw'", async () => {
    it("token was not configured it raises an error", async () => {
      await expectRevert(
        deposit.canWithdraw(tokenA.address)
      , "not configured")

      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      const result = await deposit.canWithdraw(tokenA.address)
      assert.equal(result, false)
    })

    it("time for holding the token has passed it returns true", async () => {
      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
      advanceByDays(21)
      const result = await deposit.canWithdraw(tokenA.address)
      assert.equal(result, true)
    })

    describe("price conditions", async () => {
      beforeEach(async() => {
        await mockPrice(200)
      })

      it("minimumExpectedPrice has been configured and is lower than the current price it returns true", async () => {
        await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
        const result = await deposit.canWithdraw(tokenA.address)
        assert.equal(result, true)
      })

      it("minimumExpectedPrice has been configured and is higher than the current price it returns false", async () => {
        await deposit.configureToken(tokenA.address, 20, priceFeed.address, 210, 10e7)
        const result = await deposit.canWithdraw(tokenA.address)
        assert.equal(result, false)
      })

      it("minimumExpectedPrice has not been configured it returns false", async () => {
        await deposit.configureToken(tokenA.address, 20, constants.ZERO_ADDRESS, 0, 10e7)
        const result = await deposit.canWithdraw(tokenA.address)
        assert.equal(result, false)
      })
    })
  })

  describe("'getConfiguredTokens'", async () => {
    it("returns array of token addresses", async () => {
      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 120, 10e7)
      await deposit.configureToken(tokenETH.address, 20, constants.ZERO_ADDRESS, 0, 10e7)

      const tokens = await deposit.getConfiguredTokens()
      assert.equal(tokens[0], tokenA.address)
      assert.equal(tokens[1], tokenETH.address)
      assert.equal(tokens.length, 2)
    })
  })

  describe("'withdraw'", async () => {
    beforeEach(async() => {
      await deposit.configureToken(tokenA.address, 20, priceFeed.address, 150, 10e7)
    })

    it("cannot be executed by non owner account", async () => {
      await expectRevert(
        deposit.withdraw(tokenA.address, {from: notOwner})
      , "Access denied")
    })

    it("raises an error if conditions are not fulfilled", async () => {
      await expectRevert(
        deposit.withdraw(tokenA.address)
      , "cannot withdraw")
    })

    it("sends ERC20 tokens to owner account if conditions are fulfilled", async () => {
      const balanceBefore = await tokenA.balanceOf(owner)
      assert.equal(balanceBefore, 0)
      await tokenA.transfer(deposit.address, 500, {from: notOwner})

      advanceByDays(21)

      await deposit.withdraw(tokenA.address)
      const balanceAfter = await tokenA.balanceOf(owner)

      assert.equal(balanceAfter, 500)
    })

    it("sends ETH tokens to owner account if conditions are fulfilled", async () => {
      await deposit.configureToken(constants.ZERO_ADDRESS, 20, priceFeed.address, 150, 10e7)
      await send.ether(notOwner, deposit.address, ether('1'))
      const balanceBefore = await balance.current(owner)

      advanceByDays(21)
      await deposit.withdraw(constants.ZERO_ADDRESS)

      const balanceAfter = await balance.current(owner)
      assert.ok(balanceAfter > balanceBefore)
    })
  })
})
