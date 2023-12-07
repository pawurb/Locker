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

const TOKEN_ID = 0

describe("LockerPass NFT", () => {
  let ozNFT
  let lop
  let priceFeed
  let admin
  let user2
  let user3

  const setup = async (opts) => {
    admin = (await ethers.getSigners())[0]
    user2 = (await ethers.getSigners())[1]
    user3 = (await ethers.getSigners())[2]
    const LockerPass = await ethers.getContractFactory("LockerPass")
    lop = await LockerPass.deploy(admin.address, "LockerPass", "LOP")
  }

  beforeEach(async () => {
    await setup({})
  })

  it("can be deployed and has correct attributes", async () => {
    assert.ok(lop.target)
    expect(await lop.name()).to.eq("LockerPass")
    expect(await lop.symbol()).to.eq("LOP")
  })

  describe("'mint'", async () => {
    it("can only be executed by the admin", async () => {
      await expectRevert(
        lop.connect(user2).mint(user2.address),
        "Access denied"
      )

      await lop.mint(user2.address)
    })

    it("increments a totalSupply", async () => {
      let supplyBefore = await lop.totalSupply()
      expect(supplyBefore).to.equal(0)
      await lop.mint(user2.address)
      let supplyAfter = await lop.totalSupply()
      expect(supplyAfter).to.equal(1)
    })

    it("mints an NFT token to the target account", async () => {
      await expect(lop.mint(user2.address)).to.changeTokenBalances(
        lop,
        [user2.address],
        [1]
      )

      expect(await lop.ownerOf(TOKEN_ID)).to.eq(user2.address)
    })

    it("emits a correct Transfer event", async () => {
      await expect(lop.mint(user2.address))
        .to.emit(lop, "Transfer")
        .withArgs(constants.ZERO_ADDRESS, user2.address, TOKEN_ID)
    })
  })

  describe("'transferFrom'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
    })

    it("changes owner of a correct NFT token", async () => {
      let ownerBefore = await lop.ownerOf(TOKEN_ID)
      expect(ownerBefore).to.equal(user2.address)

      await expect(
        lop.connect(user2).transferFrom(user2.address, user3.address, TOKEN_ID)
      ).to.changeTokenBalances(lop, [user2.address, user3.address], [-1, 1])

      let ownerAfter = await lop.ownerOf(TOKEN_ID)
      expect(ownerAfter).to.equal(user3.address)
    })

    it("emits a correct Transfer event", async () => {
      await expect(
        lop.connect(user2).transferFrom(user2.address, user3.address, TOKEN_ID)
      )
        .to.emit(lop, "Transfer")
        .withArgs(user2.address, user3.address, TOKEN_ID)
    })

    it("does not allow transferring token that an address does not own", async () => {
      await expectRevert(
        lop.connect(user3).transferFrom(user2.address, user3.address, TOKEN_ID),
        "Access denied"
      )
    })

    it("will not transfer a token if it is frozen", async () => {
      await lop.connect(user2).freeze(TOKEN_ID)

      await expectRevert(
        lop
          .connect(user2)
          ["safeTransferFrom(address,address,uint256)"](
            user2.address,
            user3.address,
            TOKEN_ID
          ),
        "is frozen"
      )
    })
  })

  describe("'transferFromAndFreeze'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
    })

    it("can be executed only by the token owner and not approved or operator", async () => {
      await expectRevert(
        lop
          .connect(user3)
          .transferFromAndFreeze(user2.address, user3.address, TOKEN_ID),
        "Access denied"
      )

      await lop.connect(user2).approve(user3.address, TOKEN_ID)

      await expectRevert(
        lop
          .connect(user3)
          .transferFromAndFreeze(user2.address, user3.address, TOKEN_ID),
        "Access denied"
      )

      await lop.connect(user2).setApprovalForAll(user3.address, true)

      await expectRevert(
        lop
          .connect(user3)
          .transferFromAndFreeze(user2.address, user3.address, TOKEN_ID),
        "Access denied"
      )
    })

    it("sets the token as frozen after transferring it to the new account", async () => {
      await expect(
        lop
          .connect(user2)
          .transferFromAndFreeze(user2.address, user3.address, TOKEN_ID)
      ).to.changeTokenBalances(lop, [user2.address, user3.address], [-1, 1])

      let isFrozen = await lop.isFrozen(TOKEN_ID)
      expect(isFrozen).to.equal(true)
    })
  })

  describe("'safeTransferFromAndFreeze'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
    })

    it("can be executed only by the token owner and not approved or operator", async () => {
      await expectRevert(
        lop
          .connect(user3)
          ["safeTransferFromAndFreeze(address,address,uint256)"](
            user2.address,
            user3.address,
            TOKEN_ID
          ),
        "Access denied"
      )

      await lop.connect(user2).approve(user3.address, TOKEN_ID)

      await expectRevert(
        lop
          .connect(user3)
          ["safeTransferFromAndFreeze(address,address,uint256)"](
            user2.address,
            user3.address,
            TOKEN_ID
          ),
        "Access denied"
      )

      await lop.connect(user2).setApprovalForAll(user3.address, true)

      await expectRevert(
        lop
          .connect(user3)
          ["safeTransferFromAndFreeze(address,address,uint256)"](
            user2.address,
            user3.address,
            TOKEN_ID
          ),
        "Access denied"
      )
    })

    it("sets the token as frozen after transferring it to the new account", async () => {
      await expect(
        lop
          .connect(user2)
          ["safeTransferFromAndFreeze(address,address,uint256)"](
            user2.address,
            user3.address,
            TOKEN_ID
          )
      ).to.changeTokenBalances(lop, [user2.address, user3.address], [-1, 1])

      let isFrozen = await lop.isFrozen(TOKEN_ID)
      expect(isFrozen).to.equal(true)
    })
  })

  describe("'freeze'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
    })

    it("only owner of a target NFT can trigger it", async () => {
      await expectRevert(lop.connect(user3).freeze(TOKEN_ID), "Access denied")
    })

    it("sets the target NFT as frozen so that I cannot be transferred", async () => {
      let isFrozenBefore = await lop.isFrozen(TOKEN_ID)
      expect(isFrozenBefore).to.equal(false)

      await lop.connect(user2).freeze(TOKEN_ID)

      let isFrozenAfter = await lop.isFrozen(TOKEN_ID)
      expect(isFrozenAfter).to.equal(true)

      await expectRevert(lop.connect(user2).freeze(TOKEN_ID), "already frozen")
    })
  })

  describe("'safeTransferFrom'", async () => {
    let nftHolder
    let nftNonHolder
    beforeEach(async () => {
      await lop.mint(user2.address)
      const MockNFTHolder = await ethers.getContractFactory("MockNFTHolder")
      const MockNFTNonHolder = await ethers.getContractFactory(
        "MockNFTNonHolder"
      )
      nftHolder = await MockNFTHolder.deploy()
      nftNonHolder = await MockNFTNonHolder.deploy()
    })

    it("changes owner of a correct NFT token", async () => {
      let ownerBefore = await lop.ownerOf(TOKEN_ID)
      expect(ownerBefore).to.equal(user2.address)

      await expect(
        lop
          .connect(user2)
          ["safeTransferFrom(address,address,uint256)"](
            user2.address,
            user3.address,
            TOKEN_ID
          )
      ).to.changeTokenBalances(lop, [user2.address, user3.address], [-1, 1])

      let ownerAfter = await lop.ownerOf(TOKEN_ID)
      expect(ownerAfter).to.equal(user3.address)
    })

    it("emits a correct Transfer event", async () => {
      await expect(
        lop
          .connect(user2)
          ["safeTransferFrom(address,address,uint256)"](
            user2.address,
            user3.address,
            TOKEN_ID
          )
      )
        .to.emit(lop, "Transfer")
        .withArgs(user2.address, user3.address, TOKEN_ID)
    })

    it("does not allow transferring token that an address does not own", async () => {
      await expectRevert(
        lop
          .connect(user3)
          ["safeTransferFrom(address,address,uint256)"](
            user2.address,
            user3.address,
            TOKEN_ID
          ),
        "Access denied"
      )
    })

    it("will not transfer NFT to contract which does not implement 'onERC721Received' callback", async () => {
      await expectRevert(
        lop
          .connect(user2)
          ["safeTransferFrom(address,address,uint256)"](
            user2.address,
            nftNonHolder.target,
            TOKEN_ID
          ),
        "ERC721InvalidReceiver"
      )
    })

    it("transfers NFT to contract which implements 'onERC721Received' callback", async () => {
      await lop
        .connect(user2)
        ["safeTransferFrom(address,address,uint256)"](
          user2.address,
          nftHolder.target,
          TOKEN_ID
        )
      let newOwner = await lop.ownerOf(TOKEN_ID)
      expect(newOwner).to.equal(nftHolder.target)
    })

    it("when passing data it transfers NFT to contract which implements 'onERC721Received' callback", async () => {
      await lop
        .connect(user2)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user2.address,
          nftHolder.target,
          TOKEN_ID,
          "0x"
        )
      let newOwner = await lop.ownerOf(TOKEN_ID)
      expect(newOwner).to.equal(nftHolder.target)
    })
  })

  describe("'approve'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
      await lop.mint(user2.address)
    })

    it("emits a correct event", async () => {
      await expect(lop.connect(user2).approve(user3.address, TOKEN_ID))
        .to.emit(lop, "Approval")
        .withArgs(user2.address, user3.address, TOKEN_ID)
    })

    it("grants other account permission to transfer only a target token", async () => {
      await expectRevert(
        lop.connect(user3).transferFrom(user2.address, user3.address, TOKEN_ID),
        "Access denied"
      )

      await lop.connect(user2).approve(user3.address, TOKEN_ID)

      await lop
        .connect(user3)
        .transferFrom(user2.address, user3.address, TOKEN_ID)
      let newOwner = await lop.ownerOf(TOKEN_ID)
      expect(newOwner).to.equal(user3.address)

      await expectRevert(
        lop
          .connect(user3)
          .transferFrom(user2.address, user3.address, TOKEN_ID + 1),
        "Access denied"
      )
    })

    it("can be called only be an account owning a target token", async () => {
      await expectRevert(
        lop.connect(user3).approve(user3.address, TOKEN_ID),
        "Access denied"
      )
    })
  })

  describe("'setApprovalForAll'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
      await lop.mint(user2.address)
      await lop.mint(user2.address)
    })

    it("emits a correct event", async () => {
      await expect(lop.connect(user2).setApprovalForAll(user3.address, true))
        .to.emit(lop, "ApprovalForAll")
        .withArgs(user2.address, user3.address, true)
    })

    it("grants target operator a permission to transfer all the tokens and can be reverted", async () => {
      await expectRevert(
        lop.connect(user3).transferFrom(user2.address, user3.address, TOKEN_ID),
        "Access denied"
      )

      await lop.connect(user2).setApprovalForAll(user3.address, true)

      await lop
        .connect(user3)
        .transferFrom(user2.address, user3.address, TOKEN_ID)
      await lop
        .connect(user3)
        .transferFrom(user2.address, user3.address, TOKEN_ID + 1)
      await lop.connect(user2).setApprovalForAll(user3.address, false)

      await expectRevert(
        lop
          .connect(user3)
          .transferFrom(user2.address, user3.address, TOKEN_ID + 2),
        "Access denied"
      )
    })
  })

  describe("'getApproved'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
    })

    it("throws an error for non-existent token", async () => {
      await expectRevert(
        lop.connect(user3).getApproved(TOKEN_ID + 1),
        "ERC721NonexistentToken"
      )
    })

    it("returns address approved as a target token operator", async () => {
      await lop.connect(user2).approve(user3.address, TOKEN_ID)
      let operator = await lop.connect(user2).getApproved(TOKEN_ID)
      expect(operator).to.equal(user3.address)
    })
  })

  describe("'isApprovedForAll'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
    })

    it("returns address bool indicating if target account is approved for all tokens management as a target token operator", async () => {
      let before = await lop
        .connect(user3)
        .isApprovedForAll(user2.address, user3.address)
      expect(before).to.equal(false)

      await lop.connect(user2).setApprovalForAll(user3.address, true)

      let after = await lop
        .connect(user3)
        .isApprovedForAll(user2.address, user3.address)
      expect(after).to.equal(true)
    })
  })

  describe("'burn'", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
    })

    it("can be called only by a contract admin", async () => {
      await expectRevert(lop.connect(user2).burn(TOKEN_ID), "Access denied")
    })

    it("can be called only for existing token ID", async () => {
      await expectRevert(lop.burn(TOKEN_ID + 1), "ERC721NonexistentToken")
    })

    it("destroys a target NFT and clears balances", async () => {
      let ownerBefore = await lop.ownerOf(TOKEN_ID)
      expect(ownerBefore).to.equal(user2.address)

      let balanceBefore = await lop.balanceOf(user2.address)
      expect(balanceBefore).to.equal(1)
      await lop.burn(TOKEN_ID)

      let ownerAfter = await lop.ownerOf(TOKEN_ID)
      expect(ownerAfter).to.equal(constants.ZERO_ADDRESS)

      let balanceAfter = await lop.balanceOf(user2.address)
      expect(balanceAfter).to.equal(0)
    })

    it("decrements a totalSupply", async () => {
      let supplyBefore = await lop.totalSupply()
      expect(supplyBefore).to.equal(1)
      await lop.burn(TOKEN_ID)
      let supplyAfter = await lop.totalSupply()
      expect(supplyAfter).to.equal(0)
    })
  })

  describe("edge cases", async () => {
    beforeEach(async () => {
      await lop.mint(user2.address)
      const MockERC721A = await ethers.getContractFactory("MockERC721A")
      ozNFT = await MockERC721A.deploy()
      await lop.mint(user2.address)
      await ozNFT.connect(user2).mint()
    })

    it("'mint' emits a correct event", async () => {
      await expect(ozNFT.mint())
        .to.emit(ozNFT, "Transfer")
        .withArgs(constants.ZERO_ADDRESS, admin.address, TOKEN_ID + 1)

      await expect(lop.mint(user2.address))
        .to.emit(lop, "Transfer")
        .withArgs(constants.ZERO_ADDRESS, user2.address, TOKEN_ID + 2)
    })

    it("'burn' emits a correct event", async () => {
      await expect(ozNFT.burn(TOKEN_ID))
        .to.emit(ozNFT, "Transfer")
        .withArgs(user2.address, constants.ZERO_ADDRESS, TOKEN_ID)

      await expect(lop.burn(TOKEN_ID))
        .to.emit(lop, "Transfer")
        .withArgs(user2.address, constants.ZERO_ADDRESS, TOKEN_ID)
    })

    it("sending token to the zero address", async () => {
      await expectRevert(
        ozNFT
          .connect(user2)
          .transferFrom(user2.address, constants.ZERO_ADDRESS, TOKEN_ID),
        "ERC721: transfer to the zero address"
      )

      await expectRevert(
        lop
          .connect(user2)
          .transferFrom(user2.address, constants.ZERO_ADDRESS, TOKEN_ID),
        "ERC721InvalidAddress"
      )
    })

    it("balanceOf the zero address", async () => {
      await expectRevert(
        ozNFT.connect(user2).balanceOf(constants.ZERO_ADDRESS),
        "address zero is not a valid owner"
      )

      await expectRevert(
        lop.connect(user2).balanceOf(constants.ZERO_ADDRESS),
        "ERC721InvalidAddress"
      )
    })

    it("trying to approve not owned token", async () => {
      await expectRevert(
        ozNFT.connect(user3).approve(user3.address, TOKEN_ID),
        "approve caller is not token owner"
      )

      await expectRevert(
        lop.connect(user3).approve(user3.address, TOKEN_ID),
        "Access denied"
      )
    })
  })
})
