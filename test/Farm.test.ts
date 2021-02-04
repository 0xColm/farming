import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Farm, PAYR, PayrLink } from "../typechain";


describe("Farm", function () {
  let farm: Farm;
  let payr: PAYR;
  let payrLink: PayrLink;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  beforeEach(async function() {
    [owner, user1, user2] = await ethers.getSigners();
    const PAYR = await ethers.getContractFactory("PAYR");
    const Crowdsale = await ethers.getContractFactory("Crowdsale");
    const Farm = await ethers.getContractFactory("Farm");
    const PayrLink = await ethers.getContractFactory("PayrLink");
    const ETHFactory = await ethers.getContractFactory("ETHFactory");
    const ERC20Factory = await ethers.getContractFactory("ERC20Factory");

    const startOfICO = Math.floor(Date.UTC(2022, 6, 15, 0, 0, 0) / 1000);
    const endOfICO = Math.floor(Date.UTC(2022, 6, 29, 0, 0, 0) / 1000);
    const publishDate = Math.floor(Date.UTC(2022, 6, 30, 0, 0, 0) / 1000);

    payr = await PAYR.deploy();
    await payr.deployed();
    await payr.mint(owner.address, ethers.BigNumber.from("20000000000000000000000000"));

    payrLink = await PayrLink.deploy(payr.address);
    await payrLink.deployed();

    farm = await Farm.deploy(payr.address, ethers.BigNumber.from("1000000000000000000"), startOfICO);
    await farm.deployed();
  });

  it("test_poolLength", async function () {
    expect(await farm.poolLength()).to.equal(0);
  });

  it("test_fund_asUser_thenRevert", async function () {
    await expect(farm.connect(user1).fund(1000)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("test_fund_asOwner_withExceedAllowanceAmount_thenRevert", async function () {
    await expect(farm.fund(1000)).to.be.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );
  });

  it("test_fund_asOwner_withCorrectAmount_thenSuccess", async function() {
    await payr.increaseAllowance(farm.address, 10000);  
    await farm.fund(1000);
    expect(await payr.balanceOf(farm.address)).to.equal(1000);
  });

  it("test_add_asUser_thenRevert", async function () {
    await expect(farm.connect(user1).add(1000, payrLink.address, false)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("test_add_asOwner_thenSuccess", async function () {
    await farm.add(300, payrLink.address, false);
    expect(await farm.totalAllocPoint()).to.equal(300);

    expect((await farm.poolInfo(0)).lpToken).to.equal(payrLink.address);
    const blockNumber = await ethers.getDefaultProvider().getBlockNumber();
    expect((await farm.poolInfo(0)).allocPoint).to.equal(300);
    // expect((await farm.poolInfo(0)).lastRewardBlock).to.equal(blockNumber);
    expect((await farm.poolInfo(0)).accERC20PerShare).to.equal(0);
  });

  it("test_set_asUser_thenRevert", async function () {
    await expect(farm.connect(user1).set(5000, payrLink.address, false)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("test_set_asOwner_thenSuccess", async function () {
    await farm.add(300, payrLink.address, false);
    expect(await farm.totalAllocPoint()).to.equal(300);

    await farm.set(0, 5000, false);
    expect(await farm.totalAllocPoint()).to.equal(5000);
    expect((await farm.poolInfo(0)).allocPoint).to.equal(5000);
  });

  it("test_deposited", async function () {
    await farm.add(300, payrLink.address, false);
    expect(await farm.totalAllocPoint()).to.equal(300);
    
    expect(await farm.deposited(0, owner.address)).to.equal(0);
  });

  it("test_deposit", async function () {
    await farm.add(300, payrLink.address, false);
    expect(await farm.totalAllocPoint()).to.equal(300);

    const balPayr = await payr.balanceOf(owner.address);
    console.log("balPayr", balPayr);

    const balParyLink = await payrLink.payrToken();
    console.log("balParyLink", balParyLink);

    await payr.increaseAllowance(balParyLink, 200);
    await farm.deposit(0, 100);
  });

  it("test_pending", async function () {
    await farm.add(300, payrLink.address, false);
    expect(await farm.totalAllocPoint()).to.equal(300);

  

    
    expect(await farm.pending(0, owner.address)).to.equal(0);
  });
})