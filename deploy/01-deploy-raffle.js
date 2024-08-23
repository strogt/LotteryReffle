const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify")

const FUND_AMOUNT = ethers.utils.parseEther("1") 

module.exports = async ({getNamedAccounts,deployments})=>{
    const {deploy,log} = deployments
    const {deployer} =await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId
    if(developmentChains.includes(network.name)){ // 本地网络
        let vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        // 在开发链创建和订阅（目的获取subscripionId）
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)

    } else { // 非本地网络
        vrfCoordinatorV2Address = networkConfig[chainId]["VRFCoordinator"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["raffleEntranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"] // keyHash
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["keepersUpdateInterval"]
    log("本地部署---------------------")
    const args = [vrfCoordinatorV2Address,entranceFee,gasLane,subscriptionId,callbackGasLimit,interval]
    const raffle = await deploy("Raffle",{
        from: deployer,
        args,
        log: true,
        waitCofirmations: network.config.blockConfirmations || 1,
    })

    // 不在开发链上去校验合约部署
    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY){
        log("校验中.................")
        await verify(raffle.address,args)
    }

    log("部署全部结束-----------------------")
}

module.exports.tags = ["all", "raffle"]