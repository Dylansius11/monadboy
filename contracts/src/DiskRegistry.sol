// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title DiskRegistry
/// @notice Encrypted save disks for MONADBOY, keyed by the calling disk account.
/// @dev No admin, external calls, funds custody or application loops.
contract DiskRegistry {
    /// @dev Metadata packs in declaration order. Reordering fields can introduce
    ///      another storage slot; keep the two timestamps beside the small fields.
    ///
    ///      slot 0  createdAt (64) | updatedAt (64) | difficulty (8)
    ///              | godMode (8) | tag (96)                        = 240/256
    ///      slot 1  sealedData header; blobs over 31 bytes use keccak-derived
    ///              payload slots in addition to this length header.
    ///
    ///      Solidity reserves `sealed`, so the encrypted blob is named sealedData.
    struct Disk {
        uint64 createdAt; //  64 bits, slot 0 offset 0
        uint64 updatedAt; //  64 bits, slot 0 offset 8
        uint8 difficulty; //   8 bits, slot 0 offset 16; 0 EASY, 1 NORMAL, 2 HARD
        bool godMode; //       8 bits, slot 0 offset 17
        bytes12 tag; //       96 bits, slot 0 offset 18; 16 bits remain unused
        bytes sealedData; // dynamic bytes header, slot 1
    }

    mapping(address => Disk) private _disks;

    event DiskSaved(
        address indexed disk,
        uint64 updatedAt,
        bytes32 sealedHash,
        uint8 difficulty,
        bool godMode,
        bytes12 tag
    );
    event DiskErased(address indexed disk);

    error SealedTooLarge();
    error BadDifficulty();

    /// @notice Save or replace the caller's encrypted disk, retaining its creation time.
    function save(bytes calldata sealedData, uint8 difficulty, bool godMode, bytes12 tag) external {
        if (sealedData.length > 2048) revert SealedTooLarge();
        if (difficulty > 2) revert BadDifficulty();

        Disk storage disk = _disks[msg.sender];
        // uint64 seconds overflow only after roughly 584 billion years since the Unix epoch.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 timestamp = uint64(block.timestamp);
        if (disk.createdAt == 0) disk.createdAt = timestamp;
        disk.updatedAt = timestamp;
        disk.difficulty = difficulty;
        disk.godMode = godMode;
        disk.tag = tag;
        disk.sealedData = sealedData;

        emit DiskSaved(msg.sender, timestamp, keccak256(sealedData), difficulty, godMode, tag);
    }

    /// @notice Delete only the caller's disk, including its encrypted payload.
    function erase() external {
        delete _disks[msg.sender];
        emit DiskErased(msg.sender);
    }

    /// @notice Read a disk; an unsaved or erased address returns zeroed fields.
    function diskOf(address account) external view returns (Disk memory) {
        return _disks[account];
    }
}
