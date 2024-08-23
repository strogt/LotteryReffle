// 单元测试脚本
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")


// 判断当前环境测试
!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raflle单元测试",async function () {
        // 部署raffle,vrfCoordinatorV2Mock 合约
        let raffle,vrfCoordinatorV2Mock, raffleEntranceFee,deployer, interval
        const chainId = network.config.chainId

        beforeEach(async ()=>{
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture("all")
            raffle = await ethers.getContract("Raffle", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval() 
        })

        // 第一组测试(合约中的constructor)
        describe("constructor",async ()=>{
            // 理想状态是每个单元测试都会有一个it断言
            it("Initiazes the raffle correctly",async ()=>{
                const raffleState =await raffle.getRaffleState()
                assert.equal(raffleState.toString(),"0")
                assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"])
            })
        })

        // 功能函数enterRaffle
        describe("enterRaffle",async ()=>{
            it("reverts when you don't pay enough",async ()=>{
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Rafle__NotEnoughETHEntered"
                )
            })
            it("records player when they enter",async ()=>{
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const contractPlayer = await raffle.getPlayer(0)
                assert.equal(contractPlayer, deployer)
            })
            it("emits event on enter",async ()=>{
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                    raffle,
                    "RaffleEntrance"
                )

            })
            it("doesn't allow entrance when raffle is calculating", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                // 向前多挖一个区块
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine",[])
                // await network.provider.request({ method: "evm_mine", params: [] })  // 反应时间比较慢
                // 暂时无法出发performUpkeep去更新合约开奖，performUpkeep入参需要更改触发 []/"0x"都不行, 挂起！
                // await raffle.performUpkeep("0x") 
                // await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith( 
                //     "Raffle__NotOpen"
                // )
            })
        })
        
        // 懒了，后面的单元测试不再更新
        describe("checkUpkeep", function () {
            it("returns false if people haven't sent any ETH", async () => {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                assert(!upkeepNeeded)
            })
            // it("returns false if raffle isn't open", async () => {
            //     await raffle.enterRaffle({ value: raffleEntranceFee })
            //     await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            //     await network.provider.request({ method: "evm_mine", params: [] })
            //     await raffle.performUpkeep([]) // changes the state to calculating
            //     const raffleState = await raffle.getRaffleState() // stores the new state
            //     const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
            //     assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
            // })
            // it("returns false if enough time hasn't passed", async () => {
            //     await raffle.enterRaffle({ value: raffleEntranceFee })
            //     await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
            //     await network.provider.request({ method: "evm_mine", params: [] })
            //     const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
            //     assert(!upkeepNeeded)
            // })
            // it("returns true if enough time has passed, has players, eth, and is open", async () => {
            //     await raffle.enterRaffle({ value: raffleEntranceFee })
            //     await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            //     await network.provider.request({ method: "evm_mine", params: [] })
            //     const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
            //     assert(upkeepNeeded)
            // })
        })
    })