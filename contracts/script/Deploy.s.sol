// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {DiskRegistry} from "../src/DiskRegistry.sol";

/// @notice Deploy DiskRegistry on Monad testnet only after the deployer is funded.
/// @dev From contracts/, set DEPLOYER_PRIVATE_KEY, DEPLOY_GAS_LIMIT and DEPLOY_GAS_PRICE.
///      Use measured testnet limits and a current gas price, not local EVM snapshot gas.
///      forge script script/Deploy.s.sol:Deploy --rpc-url monad_testnet \
///        --gas-limit "$DEPLOY_GAS_LIMIT" --with-gas-price "$DEPLOY_GAS_PRICE" --broadcast
contract Deploy is Script {
    function run() external returns (DiskRegistry registry) {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(privateKey);
        registry = new DiskRegistry();
        vm.stopBroadcast();
    }
}
