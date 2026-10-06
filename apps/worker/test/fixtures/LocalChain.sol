// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Local stand-ins used only by the anvil tests. They mimic the call surface the worker
// uses (ABI from the vendored Kuru and AUSD ABIs), NOT Kuru's matching semantics.
// Compiled by test/anvil.ts with forge on every run; nothing generated is committed.

contract MockToken {
    mapping(address => uint256) public balanceOf;
    bool public refuse;

    constructor(bool refuseTransfers) {
        balanceOf[msg.sender] = 1_000_000e6;
        refuse = refuseTransfers;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (refuse) return false;
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// Reports a balance but reverts every transfer, like a token that blocks sells.
contract MockRevertToken {
    function balanceOf(address) external pure returns (uint256) {
        return 1;
    }

    function transfer(address, uint256) external pure returns (bool) {
        revert("blocked");
    }
}

contract MockFaucet {
    error MaxFrequencyExceeded();

    MockToken public immutable token;
    mapping(address => uint256) public lastRequest;
    uint256 public requests;

    constructor(MockToken token_) {
        token = token_;
    }

    function requestFunds(address recipient) external {
        if (lastRequest[recipient] != 0 && block.timestamp < lastRequest[recipient] + 1 hours) revert MaxFrequencyExceeded();
        lastRequest[recipient] = block.timestamp;
        requests++;
        token.transfer(recipient, 10_000e6);
    }
}

contract MockMargin {
    mapping(address => mapping(address => uint256)) public balances;

    function setBalance(address user, address token, uint256 amount) external {
        balances[user][token] = amount;
    }

    function getBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }
}

contract MockBook {
    event OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy);

    struct Order {
        address owner;
        uint96 size;
        uint40 prev;
        uint40 next;
        uint40 flippedId;
        uint32 price;
        uint32 flippedPrice;
        bool isBuy;
    }

    uint256 public bid = type(uint256).max;
    uint256 public ask;
    uint40 public nextId = 1;
    uint256 public buys;
    uint256 public sells;
    uint96 public lastBuyQuote;
    uint96 public lastSellSize;
    mapping(uint40 => Order) public s_orders;

    function setBook(uint256 bid_, uint256 ask_) external {
        bid = bid_;
        ask = ask_;
    }

    function bestBidAsk() external view returns (uint256, uint256) {
        return (bid, ask);
    }

    // MON base / 18 dp, AUSD quote / 6 dp, 1e8 price precision, 1e10 size precision, tick 1.
    function getMarketParams() external pure returns (uint32, uint96, address, uint256, address, uint256, uint32, uint96, uint96, uint256, uint256) {
        return (1e8, 1e10, address(0), 18, address(0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC), 6, 1, 1e6, 1e22, 0, 0);
    }

    function placeAndExecuteMarketBuy(uint96 quoteSize, uint256, bool, bool) external payable returns (uint256) {
        buys++;
        lastBuyQuote = quoteSize;
        return 0;
    }

    function placeAndExecuteMarketSell(uint96 size, uint256, bool, bool) external payable returns (uint256) {
        sells++;
        lastSellSize = size;
        return 0;
    }

    function batchUpdate(uint32[] calldata buyPrices, uint96[] calldata buySizes, uint32[] calldata sellPrices, uint96[] calldata sellSizes, uint40[] calldata cancel, bool) external {
        for (uint256 i; i < cancel.length; i++) {
            require(s_orders[cancel[i]].owner == msg.sender, "owner");
            delete s_orders[cancel[i]];
        }
        for (uint256 i; i < buyPrices.length; i++) _create(buyPrices[i], buySizes[i], true);
        for (uint256 i; i < sellPrices.length; i++) _create(sellPrices[i], sellSizes[i], false);
    }

    function _create(uint32 price, uint96 size, bool isBuy) private {
        uint40 id = nextId++;
        s_orders[id] = Order(msg.sender, size, 0, 0, 0, price, 0, isBuy);
        emit OrderCreated(id, msg.sender, size, price, isBuy);
    }
}
