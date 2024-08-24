// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.7;

// 继承VRFConsumerBaseV2(@chainlink/contracts为0.4.1)
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
// 自动抽奖
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Rafle__NotEnoughETHEntered();
error Rafle__TransgerFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

/** @title 一个抽奖合约示例
 * @author stogt
 * @dev 实现了Chainlink VRF v2 以及 Chain keepers
 */

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* 开奖状态 */
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    /* 状态变量 */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    // 获取随机数变量
    VRFCoordinatorV2Interface private immutable i_vrfcoordinator;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscripionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    // 合约控制变量
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    // 事件
    event RaffleEntrance(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requsetIde);
    event WinnerPicked(address indexed winner);

    // 构造函数
    constructor(
        address vrfcoordinatorV2,
        uint _entranceFee,
        bytes32 keyHash,
        uint64 subscripionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfcoordinatorV2) {
        i_entranceFee = _entranceFee;
        i_vrfcoordinator = VRFCoordinatorV2Interface(vrfcoordinatorV2);
        i_keyHash = keyHash;
        i_subscripionId = subscripionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    /* 功能函数 */
    // 参与
    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Rafle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEntrance(msg.sender);
    }

    // chainlink keeper节点调用，他会检查upkeepNeeded是否返回TRUE
    function checkUpkeep(
        bytes memory /* checkData*/
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /*performData*/)
    {
        // 检查彩票状态
        bool isOpen = (s_raffleState == RaffleState.OPEN);
        // 检查时间
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        // 检查玩家数量
        bool hasPlayers = (s_players.length > 0);
        // 检查合约余额
        bool hasBalance = (address(this).balance > 0);

        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    // 使用Chainlink VRG请求一个随机的获胜者
    function performUpkeep(bytes calldata /*performData*/) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }

        // 获取一个随机数
        // 从chainVRF获得，分为两个交易过程（安全性）
        s_raffleState = RaffleState.CALCULATING;
        // 返回一个uint256 requestId
        uint256 requestId = i_vrfcoordinator.requestRandomWords(
            i_keyHash,
            i_subscripionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    // 继承填充随机数
    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Rafle__TransgerFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /* view/pure  function */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 _index) public view returns (address) {
        return s_players[_index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
