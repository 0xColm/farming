// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IPayrLink.sol";
import "./interfaces/IFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ETHFactory is Ownable, IFactory {
    string public name;         // Factory Name

    TransactionInfo[] public transactions;
    uint256 public currentId;

    mapping (address => uint256) private balances;          // Available balance which can be withdrawn
    mapping (address => uint256[]) private pendingFrom;     // Transaction IDs in escrow service from sender's address
    mapping (bytes32 => uint256[]) private pendingTo;       // Transaction IDs in escrow service to receipent's hash

    uint256 public poolId;          // Pool id on PayrLink
    IPayrLink payrLink;
    uint256 public feePercent = 80;         // 1 = 0.01%

    event SendTransaction(uint256 id, address from, bytes32 toHash);
    event Deposit(address from, uint256 amount);
    event Withdraw(address to, uint256 amount);

    /**
        @notice Initialize ERC20 token and Factory name
        @param _name Factory name
        @param _payrlink Interface of PayrLink
     */
    constructor(string memory _name, IPayrLink _payrlink) {
        name = _name;
        payrLink = _payrlink;
    }

    /**
        @notice Get balance of sender
     */
    function balanceOf() external view returns (uint256) {
        return balances[msg.sender];
    }

    function pendingFromIds() external view returns (uint256[] memory) {
        return pendingFrom[msg.sender];
    }

    function pendingToIds() external view returns (uint256[] memory) {
        bytes32 toHash = keccak256(abi.encodePacked(msg.sender));
        return pendingTo[toHash];
    }

    function updateFeePercent(uint256 _feePercent) external onlyOwner {
        feePercent = _feePercent;
    }

    /**
        @notice Deposit ETH to the contract
     */
    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
        @notice Update pool id of PayrLink
        @param _pid New pool id
     */
    function updatePoolId(uint256 _pid) external onlyOwner {
        poolId = _pid;
    }

    /**
        @notice Withdraw ETH from the contract
        @param amount ETH amount to withdraw
     */
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Withdraw amount exceed");
        address payable receipient = payable(msg.sender);
        balances[msg.sender] -= amount;
        receipient.transfer(amount);
        emit Withdraw(msg.sender, amount);
    }

    /**
        @notice Send ETH to a receipient's address(hashed) via Escrow service
        @param _toHash Hash of the receipient's address
        @param _amount ETH amount to send
     */
    function send(bytes32 _toHash, uint256 _amount, string memory _desc) external {
        require(balances[msg.sender] >= _amount, "Send amount exceed");
        balances[msg.sender] -= _amount;

        transactions.push(TransactionInfo(currentId, _amount, block.timestamp, 0, 0, msg.sender, _toHash, _desc));
        pendingFrom[msg.sender].push(currentId);
        pendingTo[_toHash].push(currentId);

        emit SendTransaction(currentId, msg.sender, _toHash);

        currentId ++;
    }

    /**
        @notice Release the fund of an Escrow transaction, will be called by sender
        @param _id Transaction ID
     */
    function release(uint256 _id) external {
        require(transactions[_id].from == msg.sender && transactions[_id].status < 1, "Invalid owner");
        transactions[_id].status = 1;
        transactions[_id].endedAt = block.timestamp;
    }

    function removeFromPending(uint256 _id) internal {
        address sender = transactions[_id].from;
        bytes32 toHash = transactions[_id].toHash;
        // Remove transaction id from pendingFrom array
        uint256 pendingLen = pendingFrom[sender].length;
        for (uint256 i = 0; i < pendingLen; i++) {
            if (pendingFrom[sender][i] == _id) {
                pendingFrom[sender][i] = pendingFrom[sender][pendingLen - 1];
                pendingFrom[sender].pop();
                break;
            }
        }

        // Remove transaction id from pendingTo array
        pendingLen = pendingTo[toHash].length;
        for (uint256 i = 0; i < pendingLen; i++) {
            if (pendingTo[toHash][i] == _id) {
                pendingTo[toHash][i] = pendingTo[toHash][pendingLen - 1];
                pendingTo[toHash].pop();
                break;
            }
        }
    }

    /**
        @notice Get the fund which has been available inEscrow, will be called by receipient
        @param _id Transaction ID
     */
    function getFund(uint256 _id) external {
        bytes32 toHash = keccak256(abi.encodePacked(msg.sender));

        require(transactions[_id].toHash == toHash, "Invalid receipient");
        require(transactions[_id].status == 1, "Funds are not released");

        transactions[_id].status = 2;
        
        removeFromPending(_id);

        uint256 fee = transactions[_id].amount * feePercent / 10000;
        payrLink.addReward(poolId, fee);

        balances[msg.sender] += transactions[_id].amount - fee;
    }

    /**
        @notice Cancel the escrow transaction
        @param _id Transaction ID
     */
    function cancel(uint256 _id) external {
        bytes32 toHash = keccak256(abi.encodePacked(msg.sender));

        require(transactions[_id].toHash == toHash, "Invalid receipient");
        require(transactions[_id].status == 0, "Funds are not pending");

        transactions[_id].status = 3;       // canceled
        transactions[_id].endedAt = block.timestamp;

        removeFromPending(_id);

        balances[transactions[_id].from] += transactions[_id].amount;
    }

    /**
        @notice Get stacking reward from the pool
        @param _to address to harvest
        @param _pending pending fee amount
     */
    function harvestFee(address _to, uint256 _pending) external override {
        require(msg.sender == address(payrLink), "must be payrlink");
        balances[_to] += _pending;
    }
}