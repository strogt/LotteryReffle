// 单元测试脚本
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")


// 判断当前环境测试
!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raflle单元测试",async function () {
        // 部署raffle,vrfCoordinatorV2Mock 合约
        let raffle,vrfCoordinatorV2Mock, raffleEntranceFee,deployer, interval,accounts,player,raffleContract
        const chainId = network.config.chainId

        beforeEach(async ()=>{
            accounts = await ethers.getSigners() // could also do with getNamedAccounts
              //   deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["mocks", "raffle"]) // Deploys modules with the tags "mocks" and "raffle"
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock") // Returns a new connection to the VRFCoordinatorV2Mock contract
              raffleContract = await ethers.getContract("Raffle") // Returns a new connection to the Raffle contract
              raffle = raffleContract.connect(player) // Returns a new instance of the Raffle contract connected to player
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
            
        })

        // 第一组测试(合约中的constructor)
        describe("constructor", ()=>{
            // 理想状态是每个单元测试都会有一个it断言
            it("Initiazes the raffle correctly",async ()=>{
                const raffleState =await raffle.getRaffleState()
                assert.equal(raffleState.toString(),"0")
                assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"])
            })
        })

        // 功能函数enterRaffle
        describe("enterRaffle", ()=>{
            it("reverts when you don't pay enough",async ()=>{
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Rafle__NotEnoughETHEntered"
                )
            })
            it("records player when they enter",async ()=>{
                await raffle.enterRaffle({ value: raffleEntranceFee })
                  const contractPlayer = await raffle.getPlayer(0)
                  assert.equal(player.address, contractPlayer)
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
                // 暂时无法出发performUpkeep去更新合约开奖，performUpkeep入参需要更改触发 []/"0x"都不行(版本依赖问题，0.4.1可以执行当前写法)
                await raffle.performUpkeep([]) 
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith( 
                    "Raffle__NotOpen"
                )
            })
        })
        
        describe("checkUpkeep", () => {
            it("returns false if people haven't sent any ETH", async () => {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                // callStatic模拟本地链发送交易
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                // 中断
                assert(!upkeepNeeded)
            })
            it("returns false if raffle isn't open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep([]) // changes the state to calculating
                const raffleState = await raffle.getRaffleState() // stores the new state
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
            })
            it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(upkeepNeeded)
            })
        })

        describe("performUpkeep", function () {
            it("can only run if checkupkeep is true", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep("0x") 
                assert(tx)
            })
            it("reverts if checkup is false", async () => {
                await expect(raffle.performUpkeep("0x")).to.be.revertedWith( 
                    "Raffle__UpkeepNotNeeded"
                )
            })
            // 打印日志应该txReceipt.events[1].args.requestId不返回requestId(版本问题暂时隐藏)  以及触发requestId也是多余的
            // it("updates the raffle state and emits a requestId", async () => {
            //     // Too many asserts in this test!
            //     await raffle.enterRaffle({ value: raffleEntranceFee })
            //     await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            //     await network.provider.request({ method: "evm_mine", params: [] })
            //     const txResponse = await raffle.performUpkeep("0x") // emits requestId
            //     const txReceipt = await txResponse.wait(1) // waits 1 block
            //     const raffleState = await raffle.getRaffleState() // updates state
            //     const requestId = txReceipt.events[1].args.requestId
            //     assert(requestId.toNumber() > 0)
            //     assert(raffleState.toString == '1') // 0 = open, 1 = calculating
            // })
        })

        describe("fulfillRandomWords",()=>{
            beforeEach(async ()=>{
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
            })
            it("can only be called after performupkeep", async () => {
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) // reverts if not fulfilled
                ).to.be.revertedWith("nonexistent request")
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address) // reverts if not fulfilled
                ).to.be.revertedWith("nonexistent request")
            })
            it("picks a winner, resets, and sends money", async () => {
                const additionalEntrances = 3 // to test
                const startingIndex = 2
                let startingBalance
                for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) { // i = 2; i < 5; i=i+1
                    raffle = raffleContract.connect(accounts[i]) // Returns a new instance of the Raffle contract connected to player
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                }
                const startingTimeStamp = await raffle.getLastTimeStamp() // stores starting timestamp (before we fire our event)

                // This will be more important for our staging tests...
                // await new Promise(async (resolve, reject) => {
                //     raffle.once("WinnerPicked", async () => { // event listener for WinnerPicked
                //         console.log("WinnerPicked event fired!")
                //         // assert throws an error if it fails, so we need to wrap
                //         // it in a try/catch so that the promise returns event
                //         // if it fails.
                //         try {
                //             // Now lets get the ending values...
                //             const recentWinner = await raffle.getRecentWinner()
                //             const raffleState = await raffle.getRaffleState()
                //             const winnerBalance = await accounts[2].getBalance()
                //             const endingTimeStamp = await raffle.getLastTimeStamp()
                //             await expect(raffle.getPlayer(0)).to.be.reverted
                //             // Comparisons to check if our ending values are correct:
                //             assert.equal(recentWinner.toString(), accounts[2].address)
                //             assert.equal(raffleState, 0)
                //             assert.equal(
                //                 winnerBalance.toString(), 
                //                 startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                //                     .add(
                //                         raffleEntranceFee
                //                             .mul(additionalEntrances)
                //                             .add(raffleEntranceFee)
                //                     )
                //                     .toString()
                //             )
                //             assert(endingTimeStamp > startingTimeStamp)
                //             resolve() // if try passes, resolves the promise 
                //         } catch (e) { 
                //             reject(e) // if try fails, rejects the promise
                //         }
                //     })

                //     // kicking off the event by mocking the chainlink keepers and vrf coordinator
                //     try {
                //       const tx = await raffle.performUpkeep("0x")
                //       const txReceipt = await tx.wait(1)
                //       startingBalance = await accounts[2].getBalance()
                //       await vrfCoordinatorV2Mock.fulfillRandomWords(
                //           txReceipt.events[1].args.requestId,
                //           raffle.address
                //       )
                //     } catch (e) {
                //         reject(e)
                //     }
                // })
            })
        })
    })