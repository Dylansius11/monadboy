// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {DiskRegistry} from "../src/DiskRegistry.sol";

contract DiskRegistryTest is Test {
    DiskRegistry private registry;
    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);
    bytes12 private constant TAG = bytes12("DISK 01");

    event DiskSaved(
        address indexed disk,
        uint64 updatedAt,
        bytes32 sealedHash,
        uint8 difficulty,
        bool godMode,
        bytes12 tag
    );
    event DiskErased(address indexed disk);

    function setUp() public {
        registry = new DiskRegistry();
        vm.warp(1_000);
    }

    function testSaveThenDiskOf() public {
        bytes memory sealedData = hex"01020304";
        vm.prank(alice);
        registry.save(sealedData, 2, true, TAG);

        DiskRegistry.Disk memory disk = registry.diskOf(alice);
        assertEq(disk.createdAt, 1_000);
        assertEq(disk.updatedAt, 1_000);
        assertEq(disk.difficulty, 2);
        assertTrue(disk.godMode);
        assertEq(disk.tag, TAG);
        assertEq(disk.sealedData, sealedData);
    }

    function testFirstSaveSetsCreatedAt() public {
        vm.warp(5_000);
        vm.prank(alice);
        registry.save(hex"01", 0, false, TAG);
        assertEq(registry.diskOf(alice).createdAt, 5_000);
    }

    function testOverwriteKeepsCreatedAtAndUpdatesAllOtherFields() public {
        vm.startPrank(alice);
        registry.save(hex"010203", 0, false, TAG);
        vm.warp(2_000);
        bytes12 nextTag = bytes12("SECOND");
        registry.save(hex"0405", 1, true, nextTag);
        vm.stopPrank();

        DiskRegistry.Disk memory disk = registry.diskOf(alice);
        assertEq(disk.createdAt, 1_000);
        assertEq(disk.updatedAt, 2_000);
        assertEq(disk.difficulty, 1);
        assertTrue(disk.godMode);
        assertEq(disk.tag, nextTag);
        assertEq(disk.sealedData, hex"0405");
    }

    function testEmptySealedBlobCanBeSavedAndOverwritten() public {
        vm.startPrank(alice);
        registry.save("", 0, false, TAG);
        vm.warp(2_000);
        registry.save(hex"01", 0, false, TAG);
        vm.stopPrank();
        assertEq(registry.diskOf(alice).createdAt, 1_000);
        assertEq(registry.diskOf(alice).sealedData, hex"01");
    }

    function testSealed2048BytesAccepted() public {
        bytes memory sealedData = _blob(2048);
        vm.prank(alice);
        registry.save(sealedData, 0, false, TAG);
        assertEq(registry.diskOf(alice).sealedData, sealedData);
    }

    function testSealed2049BytesReverts() public {
        bytes memory sealedData = _blob(2049);
        vm.expectRevert(DiskRegistry.SealedTooLarge.selector);
        vm.prank(alice);
        registry.save(sealedData, 0, false, TAG);
    }

    function testDifficulty3Reverts() public {
        vm.expectRevert(DiskRegistry.BadDifficulty.selector);
        vm.prank(alice);
        registry.save(hex"01", 3, false, TAG);
    }

    function testRejectedSavePreservesExistingDisk() public {
        vm.startPrank(alice);
        registry.save(hex"01", 2, true, TAG);
        vm.warp(2_000);
        vm.expectRevert(DiskRegistry.BadDifficulty.selector);
        registry.save(hex"02", 3, false, bytes12("OTHER"));
        bytes memory oversized = _blob(2049);
        vm.expectRevert(DiskRegistry.SealedTooLarge.selector);
        registry.save(oversized, 1, false, bytes12("OTHER"));
        vm.stopPrank();

        DiskRegistry.Disk memory disk = registry.diskOf(alice);
        assertEq(disk.createdAt, 1_000);
        assertEq(disk.updatedAt, 1_000);
        assertEq(disk.difficulty, 2);
        assertTrue(disk.godMode);
        assertEq(disk.tag, TAG);
        assertEq(disk.sealedData, hex"01");
    }

    function testEraseDeletesDiskAndEmitsEvent() public {
        vm.startPrank(alice);
        registry.save(_blob(1024), 2, true, TAG);
        vm.expectEmit(true, false, false, true, address(registry));
        emit DiskErased(alice);
        registry.erase();
        vm.stopPrank();
        _assertEmpty(alice);
    }

    function testSaveAfterEraseSetsNewCreatedAt() public {
        vm.startPrank(alice);
        registry.save(hex"01", 0, false, TAG);
        registry.erase();
        vm.warp(2_000);
        registry.save(hex"02", 1, false, TAG);
        vm.stopPrank();
        assertEq(registry.diskOf(alice).createdAt, 2_000);
    }

    function testDiskSavedEventFields() public {
        bytes memory sealedData = hex"01020304";
        vm.expectEmit(true, false, false, true, address(registry));
        emit DiskSaved(alice, 1_000, keccak256(sealedData), 2, true, TAG);
        vm.prank(alice);
        registry.save(sealedData, 2, true, TAG);
    }

    function testOverwriteEmitsUpdatedDiskSavedEvent() public {
        vm.startPrank(alice);
        registry.save(hex"01", 0, false, TAG);
        vm.warp(2_000);
        vm.expectEmit(true, false, false, true, address(registry));
        emit DiskSaved(alice, 2_000, keccak256(hex"02"), 1, true, TAG);
        registry.save(hex"02", 1, true, TAG);
        vm.stopPrank();
    }

    function testAnotherAddressCannotSaveOrEraseAliceDisk() public {
        vm.prank(alice);
        registry.save(hex"01", 2, true, TAG);
        vm.startPrank(bob);
        registry.save(hex"02", 0, false, bytes12("BOB"));
        registry.erase();
        vm.stopPrank();
        assertEq(registry.diskOf(alice).sealedData, hex"01");
        assertEq(registry.diskOf(alice).difficulty, 2);
        assertEq(registry.diskOf(alice).tag, TAG);
        _assertEmpty(bob);
    }

    function testUnsavedDiskIsEmpty() public view {
        _assertEmpty(alice);
    }

    function testFuzzSealedLength(uint16 rawLength) public {
        uint256 length = bound(uint256(rawLength), 0, 4096);
        bytes memory sealedData = _blob(length);
        vm.prank(alice);
        if (length > 2048) {
            vm.expectRevert(DiskRegistry.SealedTooLarge.selector);
            registry.save(sealedData, 0, false, TAG);
            _assertEmpty(alice);
        } else {
            registry.save(sealedData, 0, false, TAG);
            assertEq(registry.diskOf(alice).sealedData, sealedData);
            assertEq(registry.diskOf(alice).createdAt, 1_000);
        }
    }

    function testRejectsEther() public {
        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        (bool plainTransfer,) = address(registry).call{value: 1 wei}("");
        assertFalse(plainTransfer);
        (bool payableSave,) = address(registry).call{value: 1 wei}(
            abi.encodeCall(registry.save, (hex"01", 0, false, TAG))
        );
        assertFalse(payableSave);
        vm.stopPrank();
        assertEq(address(registry).balance, 0);
        _assertEmpty(alice);
    }

    function testGasSave1KiB() public {
        vm.pauseGasMetering();
        bytes memory sealedData = _blob(1024);
        vm.prank(alice);
        vm.resumeGasMetering();
        registry.save(sealedData, 1, false, TAG);
    }

    function _blob(uint256 length) private pure returns (bytes memory sealedData) {
        sealedData = new bytes(length);
        for (uint256 i; i < length; ++i) {
            sealedData[i] = bytes1(0xA5);
        }
    }

    function _assertEmpty(address account) private view {
        DiskRegistry.Disk memory disk = registry.diskOf(account);
        assertEq(disk.createdAt, 0);
        assertEq(disk.updatedAt, 0);
        assertEq(disk.difficulty, 0);
        assertFalse(disk.godMode);
        assertEq(disk.tag, bytes12(0));
        assertEq(disk.sealedData, "");
    }
}
