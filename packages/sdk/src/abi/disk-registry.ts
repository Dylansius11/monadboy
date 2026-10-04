// Generated from contracts/out/DiskRegistry.sol/DiskRegistry.json; run scripts/generate-disk-registry-abi.ts.
export const diskRegistryAbi = [
  {"type":"function","name":"diskOf","inputs":[{"name":"account","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"tuple","internalType":"struct DiskRegistry.Disk","components":[{"name":"createdAt","type":"uint64","internalType":"uint64"},{"name":"updatedAt","type":"uint64","internalType":"uint64"},{"name":"difficulty","type":"uint8","internalType":"uint8"},{"name":"godMode","type":"bool","internalType":"bool"},{"name":"tag","type":"bytes12","internalType":"bytes12"},{"name":"sealedData","type":"bytes","internalType":"bytes"}]}],"stateMutability":"view"},
  {"type":"function","name":"erase","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"save","inputs":[{"name":"sealedData","type":"bytes","internalType":"bytes"},{"name":"difficulty","type":"uint8","internalType":"uint8"},{"name":"godMode","type":"bool","internalType":"bool"},{"name":"tag","type":"bytes12","internalType":"bytes12"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"event","name":"DiskErased","inputs":[{"name":"disk","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
  {"type":"event","name":"DiskSaved","inputs":[{"name":"disk","type":"address","indexed":true,"internalType":"address"},{"name":"updatedAt","type":"uint64","indexed":false,"internalType":"uint64"},{"name":"sealedHash","type":"bytes32","indexed":false,"internalType":"bytes32"},{"name":"difficulty","type":"uint8","indexed":false,"internalType":"uint8"},{"name":"godMode","type":"bool","indexed":false,"internalType":"bool"},{"name":"tag","type":"bytes12","indexed":false,"internalType":"bytes12"}],"anonymous":false},
  {"type":"error","name":"BadDifficulty","inputs":[]},
  {"type":"error","name":"SealedTooLarge","inputs":[]},
] as const
