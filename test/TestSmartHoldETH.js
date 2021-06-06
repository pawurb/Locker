const Web3 = require("web3");
const timeMachine = require('ganache-time-traveler');

const SmartHoldETH = artifacts.require("SmartHoldETH");
const PriceFeedMock = artifacts.require("PriceFeedMock");

const advanceByDays = async (days) => {
  await timeMachine.advanceTimeAndBlock(days * 86400);
};

contract("SmartHoldETH", async (accounts) => {
  const owner = accounts[0];
  const notOwner = accounts[1];
  const value = Web3.utils.toWei("0.01", "ether");
  let lockForDays = 5;
  let deposit;
  let priceFeed;

  const mockPrice = async (priceOpts) => {
    priceFeed = await PriceFeedMock.new(priceOpts.current * 100000000)

    deposit = await SmartHoldETH.new(
      priceFeed.address,
      lockForDays,
      priceOpts.minimum,
      {
        value: value,
        from: owner
      }
    )
  }

  beforeEach(async () => {
    await mockPrice(
      { current: 0, minimum: 100 }
    );
  });

  describe("'constructor'", async () => {
    it("does not allow locking funds for too long", async () => {
      let notExpected = false;

      try {
        await SmartHoldETH.new(
          priceFeed.address,
          4050,
          0
        )
        notExpected = true;
      } catch (err) {
        assert.ok(err);
      }

      assert.ok(!notExpected)
    });

    it("does not accept negative minimum price", async () => {
      let notExpected = false;

      try {
        await SmartHoldETH.new(
          priceFeed.address,
          50,
          -20
        )
        notExpected = true;
      } catch (err) {
        assert.ok(err);
      }

      assert.ok(!notExpected)
    });

    it("deposit gets deployed to test network and accepts initial ETH transfer", async () => {
      assert.ok(deposit.address);

      const balance = await web3.eth.getBalance(deposit.address);
      assert.equal(balance, value);
    });

    it("sets the correct owner and other attributes", async () => {
      assert.equal(
        await deposit.owner(),
        owner
      );

      assert.equal(
        await deposit.lockForDays(),
        lockForDays
      );

      assert.equal(
        await deposit.minimumPrice(),
        100
      );
    });

    it("accepts more ETH transfer after deployment", async () => {
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: deposit.address,
        value: value
      });

      const balance = await web3.eth.getBalance(deposit.address);
      assert.equal(balance, value * 2);
    });
  });

  describe("'widthraw'", async () => {
    beforeEach(async() => {
      let snapshot = await timeMachine.takeSnapshot();
      snapshotId = snapshot['result'];
    });

    afterEach(async() => {
      await timeMachine.revertToSnapshot(snapshotId);
    });

    it("can only be called by the deposit contract owner", async () => {
      let notExpected = false;

      try {
        await deposit.widthraw({from: notOwner});
        notExpected = true;
      } catch (err) {
        assert.ok(err);
      }

      assert.ok(!notExpected)
    });

    it("required time did not pass yet, it does not widthraw funds", async () => {
      let notExpected = false;
      const ownerBalanceBefore = await web3.eth.getBalance(owner);

      try {
        await deposit.widthraw({from: owner});
        notExpected = true;
      } catch (err) {
        assert.ok(err);
      }

      assert.ok(!notExpected)

      const balance = await web3.eth.getBalance(deposit.address);
      assert.equal(balance, value);

      const ownerBalanceAfter = await web3.eth.getBalance(owner);
      assert.ok(ownerBalanceAfter < ownerBalanceBefore);
    });

    it("required time has already passed, it widthraws funds", async () => {
      const canWidthrawBefore = await deposit.canWidthraw({from: owner});
      assert.equal(canWidthrawBefore, false);
      await advanceByDays(lockForDays + 1);

      const canWidthrawAfter = await deposit.canWidthraw({from: owner});
      assert.equal(canWidthrawAfter, true);

      const ownerBalanceBefore = await web3.eth.getBalance(owner);
      await deposit.widthraw({from: owner});
      const balance = await web3.eth.getBalance(deposit.address);
      assert.equal(balance, 0);
      const ownerBalanceAfter = await web3.eth.getBalance(owner);
      assert.ok(ownerBalanceAfter > ownerBalanceBefore);
    });

    describe("widthrawing based on price", async () => {
      describe("required min price is met", async () => {
        beforeEach(async () => {
          await mockPrice(
            { current: 123, minimum: 100 }
          );
        });

        it("it widthraws funds", async () => {
          const canWidthraw = await deposit.canWidthraw({from: owner});
          assert.equal(canWidthraw, true);
        });
      });

      describe("required min price is not met", async () => {
        beforeEach(async () => {
          await mockPrice(
            { current: 90, minimum: 100 }
          );
        });

        it("it does not widthraw funds", async () => {
          const canWidthraw = await deposit.canWidthraw({from: owner});
          assert.equal(canWidthraw, false);
        });
      });

      describe("contract does not use price condition for widthrawal and time did not pass yet", async () => {
        beforeEach(async () => {
          await mockPrice(
            { current: 100, minimum: 0 }
          );
        });

        it("it does not widthraw funds", async () => {
          const canWidthraw = await deposit.canWidthraw({from: owner});
          assert.equal(canWidthraw, false);
        });
      });
    });
  });
});
