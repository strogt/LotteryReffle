const { ethers } = require("hardhat")

const networkConfig = {
    11155111: {
        name: "sepolia",
        subscriptionId: "6926",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // keyHash
        keepersUpdateInterval: "30", // interval
        raffleEntranceFee: ethers.utils.parseEther("0.01"), // entranceFee
        callbackGasLimit: "500000", // 500,000 gas
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    },
    31337:{
        name: "hardhat",
        raffleEntranceFee: ethers.utils.parseEther("0.01"), // 0.01 ETH
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // keyHash
        callbackGasLimit: "500000", // 500,000 gas
        keepersUpdateInterval: "30", // interval
    }

}

const developmentChains = ["hardhat","localhost"]

module.exports = {
    networkConfig,
    developmentChains
}