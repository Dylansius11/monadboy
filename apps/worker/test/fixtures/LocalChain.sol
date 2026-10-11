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
    struct Point { uint40 head; uint40 tail; }
    mapping(uint256 => Point) public s_buyPricePoints;
    mapping(uint256 => Point) public s_sellPricePoints;

    uint256 public bid = type(uint256).max;
    uint256 public ask;
    uint40 public nextId = 1;
    uint256 public buys;
    uint256 public sells;
    uint96 public lastBuyQuote;
    uint96 public lastSellSize;
    uint256 public externalBase = 100e18;
    uint256 public externalQuote = 100e6;
    uint256 public canceled;
    mapping(uint40 => Order) public s_orders;

    function setBook(uint256 bid_, uint256 ask_) external {
        bid = bid_;
        ask = ask_;
    }

    function bestBidAsk() external view returns (uint256 bestBid, uint256 bestAsk) {
        bestBid = bid;
        bestAsk = ask;
        for (uint40 id = 1; id < nextId; id++) {
            Order memory order = s_orders[id];
            if (order.size == 0 || !_linked(id)) continue;
            uint256 price = uint256(order.price) * 1e10;
            if (order.isBuy && (bestBid == type(uint256).max || price > bestBid)) bestBid = price;
            if (!order.isBuy && (bestAsk == 0 || price < bestAsk)) bestAsk = price;
        }
    }

    // MON base / 18 dp, AUSD quote / 6 dp, 1e8 price precision, 1e10 size precision, tick 1.
    function getMarketParams() external pure returns (uint32, uint96, address, uint256, address, uint256, uint32, uint96, uint96, uint256, uint256) {
        return (1e8, 1e10, address(0), 18, address(0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC), 6, 1, 1e6, 1e22, 0, 0);
    }

    function placeAndExecuteMarketBuy(uint96 quoteSize, uint256, bool, bool) external payable returns (uint256 output) {
        require(ask > 0, "no external ask");
        _assertNoOwnOrdersBefore(false, ask);
        uint256 quoteRaw = uint256(quoteSize) / 100;
        output = quoteRaw * 1e30 / ask;
        require(externalBase >= output, "external base");
        externalBase -= output;
        externalQuote += quoteRaw;
        buys++;
        lastBuyQuote = quoteSize;
        ask = 0;
    }

    function placeAndExecuteMarketSell(uint96 size, uint256, bool, bool) external payable returns (uint256 output) {
        require(bid != type(uint256).max && bid > 0, "no external bid");
        _assertNoOwnOrdersBefore(true, bid);
        uint256 baseRaw = uint256(size) * 1e8;
        output = baseRaw * bid / 1e30;
        require(externalQuote >= output, "external quote");
        externalQuote -= output;
        externalBase += baseRaw;
        sells++;
        lastSellSize = size;
        bid = type(uint256).max;
    }

    // A taker walks the best prices first: the caller's own resting order at or better than the
    // external level would be hit before it. Orders behind that level are untouched.
    function _assertNoOwnOrdersBefore(bool isBuy, uint256 external1e18) private view {
        for (uint40 id = 1; id < nextId; id++) {
            Order memory order = s_orders[id];
            if (order.owner != msg.sender || order.isBuy != isBuy || !_linked(id)) continue;
            uint256 price = uint256(order.price) * 1e10;
            require(isBuy ? price < external1e18 : price > external1e18, "self trade");
        }
    }

    // Kuru layout: block word, bid (price, size) pairs, a zero word, ask pairs. Unaggregated here.
    function getL2Book() external view returns (bytes memory book) {
        book = abi.encodePacked(block.number);
        if (bid != type(uint256).max && bid > 0)
            book = abi.encodePacked(book, bid / 1e10, externalQuote * 1e22 / bid / 2);
        book = _appendOwn(book, true);
        book = abi.encodePacked(book, uint256(0));
        if (ask > 0) book = abi.encodePacked(book, ask / 1e10, externalBase / 2 / 1e8);
        book = _appendOwn(book, false);
    }

    function _appendOwn(bytes memory book, bool isBuy) private view returns (bytes memory) {
        for (uint40 id = 1; id < nextId; id++) {
            Order memory order = s_orders[id];
            if (order.size == 0 || order.isBuy != isBuy || !_linked(id)) continue;
            book = abi.encodePacked(book, uint256(order.price), uint256(order.size));
        }
        return book;
    }

    function batchCancelOrders(uint40[] calldata ids) external {
        for (uint256 i; i < ids.length; i++) {
            require(s_orders[ids[i]].owner == msg.sender, "owner");
            _unlink(ids[i]);
            delete s_orders[ids[i]];
            canceled++;
        }
    }

    function batchUpdate(uint32[] calldata buyPrices, uint96[] calldata buySizes, uint32[] calldata sellPrices, uint96[] calldata sellSizes, uint40[] calldata cancel, bool) external {
        for (uint256 i; i < cancel.length; i++) {
            require(s_orders[cancel[i]].owner == msg.sender, "owner");
            _unlink(cancel[i]);
            delete s_orders[cancel[i]];
        }
        for (uint256 i; i < buyPrices.length; i++) _create(buyPrices[i], buySizes[i], true);
        for (uint256 i; i < sellPrices.length; i++) _create(sellPrices[i], sellSizes[i], false);
    }

    function _create(uint32 price, uint96 size, bool isBuy) private {
        uint40 id = nextId++;
        Point storage point = isBuy ? s_buyPricePoints[price] : s_sellPricePoints[price];
        s_orders[id] = Order(msg.sender, size, point.tail, 0, 0, price, 0, isBuy);
        if (point.tail != 0) s_orders[point.tail].next = id;
        else point.head = id;
        point.tail = id;
        emit OrderCreated(id, msg.sender, size, price, isBuy);
    }

    function _linked(uint40 id) private view returns (bool) {
        Order storage order = s_orders[id];
        Point storage point = order.isBuy ? s_buyPricePoints[order.price] : s_sellPricePoints[order.price];
        for (uint40 next = point.head; next != 0; next = s_orders[next].next)
            if (next == id) return true;
        return false;
    }

    function _unlink(uint40 id) private {
        require(_linked(id), "not active");
        Order storage order = s_orders[id];
        Point storage point = order.isBuy ? s_buyPricePoints[order.price] : s_sellPricePoints[order.price];
        if (order.prev == 0) point.head = order.next;
        else s_orders[order.prev].next = order.next;
        if (order.next == 0) point.tail = order.prev;
        else s_orders[order.next].prev = order.prev;
    }

    // Model the real plain-order finding: matching removes membership but leaves s_orders size.
    function fillPlain(uint40 id) external {
        _unlink(id);
    }
}
