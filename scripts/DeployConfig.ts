export interface IDeployConfig {
	owner: string
	mint: string
	lpExist: boolean
	farm_param: {
    rewardPerBlock: string
    delay: number
    fund: string
    lp: [
      {
        address: string
        allocPoint: number
      }
    ]
  }
  PAYR: string
  Presale: string
  Crowdsale: string
  PAYRLINK: string
  ETH_FACTORY: string
  DAI_FACTORY: string
  DAI: string
  FARM: string 
}