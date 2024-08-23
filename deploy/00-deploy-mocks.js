const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = "250000000000000000" 
const GAS_PRICE_LINK = 1e9 


module.exports = async ({getNamedAccounts,deployments})=>{
    const {deploy,log} = deployments
    const {deployer} =await getNamedAccounts()

    const chainId = network.config.chainId


    // 检验本地环境部署mock数据
    if( developmentChains.includes(network.name)){
        log("mock环境部署....................")
        await deploy("VRFCoordinatorV2Mock",{
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("mock部署完成-----------------------")
    }

}

module.exports.tags = ["all", "mocks"]