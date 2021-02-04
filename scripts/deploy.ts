import { ethers } from "hardhat";
import {IDeployConfig} from "./DeployConfig";

async function main() {
  const PAYR = await ethers.getContractFactory("PAYR");
  const Crowdsale = await ethers.getContractFactory("Crowdsale");
  const Farm = await ethers.getContractFactory("Farm");
  const PAYRLINK = await ethers.getContractFactory("PayrLink");
  const ETHFactory = await ethers.getContractFactory("ETHFactory");
  const ERC20Factory = await ethers.getContractFactory("ERC20Factory");

  const config: IDeployConfig = {
    owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
	  mint: "20000000000000000000000000",
	  lpExist: true,
    farm_param: {
      rewardPerBlock: "1000000000000000000",
      delay: 30,
      fund: "10000000000000000000000000",
      lp: [
        {
          address: "",
          allocPoint: 100
        }
      ]
    },
    PAYR: "",
    Presale: "",
    Crowdsale: "",
    PAYRLINK: "",
    ETH_FACTORY: "",
    DAI_FACTORY: "",
    DAI: "",
    FARM: "", 
  }

  let dataParse: any = {};

  const startOfICO = Math.floor(Date.UTC(2022, 6, 15, 0, 0, 0) / 1000);
  const endOfICO = Math.floor(Date.UTC(2022, 6, 29, 0, 0, 0) / 1000);
  const publishDate = Math.floor(Date.UTC(2022, 6, 30, 0, 0, 0) / 1000);

  const payr = await PAYR.deploy();
  await payr.deployed();
  dataParse['PAYR'] = payr.address;
  await payr.mint(config.owner, ethers.BigNumber.from(config.mint));

  const crowdsale = await Crowdsale.deploy(dataParse['PAYR'], startOfICO, endOfICO, publishDate);
  await crowdsale.deployed();
  dataParse['Crowdsale'] = crowdsale.address;

  const provider = await ethers.getDefaultProvider();
  const currentBlock = await provider.getBlockNumber();
  const startBlock = ethers.BigNumber.from(currentBlock).add(ethers.BigNumber.from(config.farm_param.delay));
  const farm =await Farm.deploy(dataParse['PAYR'], ethers.BigNumber.from(config.farm_param.rewardPerBlock), startBlock);
  await farm.deployed();
  dataParse['Farm'] = farm.address;

  if(config.farm_param.fund) {
    await payr.approve(farm.address, ethers.BigNumber.from(config.farm_param.fund));
    await farm.fund(ethers.BigNumber.from(config.farm_param.fund));
  }

  for (let i = 0; i < config.farm_param.lp.length; i++) {
    const token = config.farm_param.lp[i];
    token.address = dataParse['PAYR'];
    if (token.address) {
      await farm.add(token.allocPoint, token.address, false);
    }
  }

  const payrLink = await PAYRLINK.deploy(dataParse['PAYR']);
  await payrLink.deployed();
  dataParse['PAYRLINK'] = payrLink.address;

  const ethFactory = await ETHFactory.deploy("ETH", dataParse['PAYRLINK']);
  await ethFactory.deployed();
  dataParse['ETH_FACTORY'] = ethFactory.address;

  await payrLink.addPool(dataParse['ETH_FACTORY'], true);
  await ethFactory.updatePoolId(0);

  // const daiFactory = await ERC20Factory.deploy(config.DAI, "DAI", dataParse['PAYRLINK']);
  // await daiFactory.deployed();
  // dataParse['DAI_FACTORY'] = daiFactory.address;

  // await payrLink.addPool(dataParse['DAI_FACTORY'], true);
  // await daiFactory.updatePoolId(1);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
