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

describe("SmartHoldETH", () => {
  let smartHold;
  let owner
  let notOwner
  const value = ethers.utils.parseEther("2.01")
  const lockForDays = 100

  const setup = async (opts) => {
    opts.minimumPrice = opts.minimumPrice || 0
    opts.currentPrice = opts.currentPrice || 0
    opts.lockForDays = opts.lockForDays || 1000
    opts.priceFeedContract = opts.priceFeedContract || "PriceFeedMock"

    owner = (await ethers.getSigners())[0]
    notOwner = (await ethers.getSigners())[1]

    const PriceFeedMock = await ethers.getContractFactory(opts.priceFeedContract);
    const SmartHoldETH = await ethers.getContractFactory("SmartHoldETH");
    const priceFeed = await PriceFeedMock.deploy(opts.currentPrice * 10e7)
    smartHold = await SmartHoldETH.deploy(
      priceFeed.address,
      opts.lockForDays,
      opts.minimumPrice,
      {
        value: value
      }
    )
  }

  beforeEach(async () => {
    await setup(
      { currentPrice: 0, minimumPrice: 10000, lockForDays: lockForDays }
    )
  })

  describe("Constructor", () => {
    it("does not allow locking funds for too long", async () => {
      await expectRevert(
        setup({ lockForDays: 20000 })
      , "Too long")
    });

    it("does not accept negative minimum price", async () => {
      await expectRevert(
        setup({ minimumPrice: -20 })
      , "Price must not")
    })

    it("contract gets deployed to test network and accepts initial ETH transfer", async () => {
      assert.ok(smartHold.address)

      expect(await ethers.provider.getBalance(smartHold.address)).to.equal(value)
    })

    it("sets the correct owner and other attributes", async () => {
      assert.equal(
        await smartHold.owner(),
        owner.address
      )

      assert.equal(
        await smartHold.lockForDays(),
        100
      )

      assert.equal(
        await smartHold.minimumPrice(),
        10000
      )
    })

    it("accepts more ETH transfer after deployment", async () => {
      await owner.sendTransaction({ value: value, to: smartHold.address })

      expect(await ethers.provider.getBalance(smartHold.address)).to.equal(value.mul(2))
    })
  })

  describe("'withdraw'", async () => {
    it("can only be called by the deposit contract owner", async () => {
      await expectRevert(
        smartHold.connect(notOwner).withdraw()
      , "Access denied")
    })

    it("required time did not pass yet, it does not withdraw funds", async () => {
      await expectRevert(
        smartHold.withdraw()
      , "Cannot withdraw")
    })

    it("required time has already passed, it withdraws funds", async () => {
      await advanceByDays(lockForDays + 1);
      const canWithdrawAfter = await smartHold.canWithdraw()
      expect(canWithdrawAfter).to.equal(true)

      await expect(smartHold.withdraw()).to.changeEtherBalances(
        [owner, smartHold],
        [value, value.mul(-1)]
      );
    });
  });

  describe("withdrawing based on price", async () => {
    describe("required min price is met", async () => {
      beforeEach(async () => {
        await setup(
          { currentPrice: 123, minimumPrice: 100 }
        )
      })

      it("it withdraws funds", async () => {
        const canWithdraw = await smartHold.canWithdraw();
        expect(canWithdraw).to.equal(true);
      })
    })

    describe("required min price is not met", async () => {
      beforeEach(async () => {
        await setup(
          { currentPrice: 90, minimumPrice: 100 }
        )
      })

      it("it does not withdraw funds", async () => {
        const canWithdraw = await smartHold.canWithdraw()
        expect(canWithdraw).to.equal(false);
      })
    })

    describe("contract does not use price condition for withdrawal and time did not pass yet", async () => {
      beforeEach(async () => {
        await setup(
          { currentPrice: 100, minimumPrice: 0 }
        )
      })

      it("it does not withdraw funds", async () => {
        const canWithdraw = await smartHold.canWithdraw()
        expect(canWithdraw).to.equal(false);
      })
    })

    describe("price feed execution returns error and required time has not yet passed", async () => {
      it("crashes", async () => {
        await setup({ minimumPrice: 1500, priceFeedContract: "BuggyPriceFeedMock" })
        await expectRevert(
          smartHold.canWithdraw()
        , "Price oracle bug!")
      })
    })

    describe("price feed execution returns error and required time has already passed", async () => {
      it("it withdraws funds", async () => {
        await setup({ minimumPrice: 1500, priceFeedContract: "BuggyPriceFeedMock", lockForDays: lockForDays })

        await advanceByDays(lockForDays + 1)
        const canWithdraw = await smartHold.canWithdraw();
        expect(canWithdraw).to.equal(true);
      })
    })
  })
});
