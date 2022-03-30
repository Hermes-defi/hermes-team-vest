import { expect } from "chai";
import { ethers } from "hardhat";
import {
  HermesToken,
  HermesToken__factory,
  HermesVesting,
  HermesVesting__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@openzeppelin/test-helpers";

describe("BentVesting", () => {
  let hermes: HermesToken, vesting: HermesVesting;
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    admin: SignerWithAddress;
  const epochLength = 60 * 5; // 5 mins

  before(async () => {
    [, admin, alice, bob] = await ethers.getSigners();
  });

  beforeEach(async () => {
    hermes = await new HermesToken__factory(admin).deploy();
    await hermes.deployed();

    vesting = await new HermesVesting__factory(admin).deploy(
      hermes.address,
      (
        await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
      ).timestamp + epochLength,
      epochLength
    );

    await hermes
      .connect(admin)
      .transfer(vesting.address, ethers.utils.parseUnits("100000"));
  });

  describe("createVesting", () => {
    it("non-owner can't call create vesting", async () => {
      await expect(
        vesting
          .connect(alice)
          .createVesting(alice.address, ethers.utils.parseUnits("10000"), 1, 10)
      ).to.revertedWith("Ownable: caller is not the owner");
    });

    it("it checkes user's address", async () => {
      await expect(
        vesting.createVesting(
          "0x0000000000000000000000000000000000000000",
          ethers.utils.parseUnits("10000"),
          1,
          10
        )
      ).to.revertedWith("Invalid address!");
      await expect(
        vesting.createVesting(
          hermes.address,
          ethers.utils.parseUnits("10000"),
          1,
          10
        )
      ).to.revertedWith("Invalid address!");
    });

    it("it checkes amount", async () => {
      await expect(
        vesting.createVesting(
          alice.address,
          ethers.utils.parseUnits("0"),
          1,
          10
        )
      ).to.revertedWith("Invalid amount!");
    });

    it("it checkes start epoch and duration", async () => {
      await expect(
        vesting.createVesting(
          alice.address,
          ethers.utils.parseUnits("1000"),
          0,
          10
        )
      ).to.revertedWith("Invalid request!");
      await expect(
        vesting.createVesting(
          alice.address,
          ethers.utils.parseUnits("1000"),
          1,
          0
        )
      ).to.revertedWith("Invalid request!");
    });

    it("owner can create vesting", async () => {
      await vesting.createVesting(
        alice.address,
        ethers.utils.parseUnits("1000"),
        1,
        10
      );
      await vesting.createVesting(
        bob.address,
        ethers.utils.parseUnits("1000"),
        1,
        10
      );
      await vesting.createVesting(
        alice.address,
        ethers.utils.parseUnits("1000"),
        1,
        10
      );
      await vesting.createVesting(
        alice.address,
        ethers.utils.parseUnits("1000"),
        1,
        10
      );
      expect((await vesting.vestingsByAddress(alice.address))[0]).to.equal(0);
      expect((await vesting.vestingsByAddress(alice.address))[1]).to.equal(2);
      expect((await vesting.vestingsByAddress(alice.address))[2]).to.equal(3);
      expect((await vesting.vestingsByAddress(bob.address))[0]).to.equal(1);
    });
  });

  describe("claim", () => {
    it("it checks vesting ID", async () => {
      await expect(vesting.connect(alice).claim(0)).to.revertedWith(
        "Invalid index!"
      );
      await expect(vesting.claimable(0)).to.revertedWith("Invalid index!");
    });

    it("it checks msg.sender", async () => {
      await vesting.createVesting(
        alice.address,
        ethers.utils.parseUnits("1000"),
        1,
        10
      );

      await expect(vesting.claim(0)).to.revertedWith("unauthorized");
    });

    it("no claimable before epoch start", async () => {
      await vesting.createVesting(
        alice.address,
        ethers.utils.parseUnits("1000"),
        1,
        10
      );

      expect(await vesting.claimable(0)).to.equal(0);
      await expect(vesting.connect(alice).claim(0)).to.revertedWith(
        "unable to claim"
      );
    });

    it("no claimable after epoch duration", async () => {
      await vesting.createVesting(
        alice.address,
        ethers.utils.parseUnits("1000"),
        1,
        10
      );

      await time.increase(epochLength * 10);
      time.advanceBlock(1);
      expect(await vesting.claimable(0)).to.equal(
        ethers.utils.parseUnits("1000")
      );
      await vesting.connect(alice).claim(0);

      await time.increase(epochLength * 10);
      expect(await vesting.claimable(0)).to.equal(0);
      await expect(vesting.connect(alice).claim(0)).to.revertedWith(
        "unable to claim"
      );
    });

    it("claim as expected", async () => {
      await vesting.createVesting(
        alice.address,
        ethers.utils.parseUnits("1000"),
        1,
        10
      );

      await time.increase(epochLength);
      await time.advanceBlock(1);
      expect(await vesting.claimable(0)).to.equal(
        ethers.utils.parseUnits("100")
      );
      await vesting.connect(alice).claim(0);
      expect(await hermes.balanceOf(alice.address)).to.equal(
        ethers.utils.parseUnits("100")
      );

      await time.increase(epochLength * 3);
      await time.advanceBlock(1);
      expect(await vesting.claimable(0)).to.equal(
        ethers.utils.parseUnits("300")
      );
      await vesting.connect(alice).claim(0);
      expect(await hermes.balanceOf(alice.address)).to.equal(
        ethers.utils.parseUnits("400")
      );

      await time.increase(epochLength * 7);
      await time.advanceBlock(1);
      expect(await vesting.claimable(0)).to.equal(
        ethers.utils.parseUnits("600")
      );
      await vesting.connect(alice).claim(0);
      expect(await hermes.balanceOf(alice.address)).to.equal(
        ethers.utils.parseUnits("1000")
      );
    });
  });
});
