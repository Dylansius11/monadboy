/** Receipt-backed samples from chain 10143, deployed MON/AUSD market
 * 0xD9F66B3bdBb1741f33e01fA3Acb514623e0a60Bc. Limits already include ceil(estimate * 1.2).
 * Monad billed gasUsed equals declared gasLimit, not independent instruction-gas usage.
 * Samples are shape-specific, NOT universal worst-case limits. Partial margin trades were
 * 0.01 AUSD buy / 0.1 MON sell; plainQuotes2 adds one bid+ask without cancellation.
 * Larger traversals and quote replacement require fresh bounded estimation.
 * Source: external market-funded-public.json and the linked successful receipts.
 */
export type MeasuredGasSample = {
  estimate: bigint
  gasLimit: bigint
  transactionHash: `0x${string}`
  blockNumber: bigint
}

export const measuredTestnetGas = {
  faucet: {
    estimate: 130600n,
    gasLimit: 156720n,
    transactionHash:
      '0x80d2b84ddbe529a6f3692cf26f034054957b0c881a43a9278926512d4932737b',
    blockNumber: 68939636n,
  },
  erc20Transfer: {
    estimate: 72918n,
    gasLimit: 87502n,
    transactionHash:
      '0x75e29d14ef580fd07a12d76220cb78b0aecdc7a3d96abe1c0b42a2dfaa2b5bf6',
    blockNumber: 68940085n,
  },
  approveMargin: {
    estimate: 71087n,
    gasLimit: 85305n,
    transactionHash:
      '0x253fb855884baa6a0fd416e85968ddb4b9dcc43f522ca505556f4ee682ff1552',
    blockNumber: 68942620n,
  },
  approveMarket: {
    estimate: 71099n,
    gasLimit: 85319n,
    transactionHash:
      '0x7dcaf15738410c1d8e31021f5927a843b5b740c6605293b0de919ea711e6e698',
    blockNumber: 68941199n,
  },
  marketBuyMarginPartial: {
    estimate: 237627n,
    gasLimit: 285153n,
    transactionHash:
      '0x1fe3a6e452f0185868d42a724c7e5189572d8c91cd2972636d24b380d4342a9a',
    blockNumber: 68942697n,
  },
  marketBuyWalletPartial: {
    estimate: 258383n,
    gasLimit: 310060n,
    transactionHash:
      '0xa4a7921eb1ccb4476b4bb72d32d394dddfa4798f55c38f6b5fdf40b975060c6f',
    blockNumber: 68942558n,
  },
  marketSellWalletFullFlip: {
    estimate: 398362n,
    gasLimit: 478035n,
    transactionHash:
      '0x2cd0db5af73081ec5d124530ccdb3affa243894429bef9fee9b608a5668f270b',
    blockNumber: 68940976n,
  },
  marketSellMarginPartial: {
    estimate: 226860n,
    gasLimit: 272232n,
    transactionHash:
      '0xe2a33b4ca3068977ada34a1027d96e0120e8fa843d8a9e5d3bd231a64abeecf3',
    blockNumber: 68942735n,
  },
  cancel16: {
    estimate: 869091n,
    gasLimit: 1042910n,
    transactionHash:
      '0x71af91781a95ea63ee9da07d9c6e20c4716885bb8ff43a33a660fb47b72796ad',
    blockNumber: 68943583n,
  },
  cancelLinked4: {
    estimate: 382011n,
    gasLimit: 458414n,
    transactionHash:
      '0x70a5f4b138491fa7b2f2d48044f6859d13a3b6572fba7a44ea125009023804c6',
    blockNumber: 68943094n,
  },
  cancelPlain2: {
    estimate: 254240n,
    gasLimit: 305088n,
    transactionHash:
      '0x756c5aad36d37e011337a20461bec695abc97071ea359ec6136749e846daf715',
    blockNumber: 68943232n,
  },
  depositQuote: {
    estimate: 136602n,
    gasLimit: 163923n,
    transactionHash:
      '0x6cb678d62c9e52deb8285b29e0670e62af80778ff400ddc5a936641b94c511ce',
    blockNumber: 68940746n,
  },
  depositNative: {
    estimate: 79645n,
    gasLimit: 95574n,
    transactionHash:
      '0xa6d4f184a5ac5484aa26b9c2e4e277483825f11b3e11af9ba4fd830396388157',
    blockNumber: 68940780n,
  },
  depositNativeExisting: {
    estimate: 62578n,
    gasLimit: 75094n,
    transactionHash:
      '0x279f1c40722061bb02f87d0699c38f954d2ce9a5d1795f1e2d87786506679530',
    blockNumber: 68943311n,
  },
  withdrawBounded: {
    estimate: 130672n,
    gasLimit: 156807n,
    transactionHash:
      '0x7d93179b877b49e7b64efb83d13b66ab596eada1ee625c55a6ec85dc5fb7013f',
    blockNumber: 68943647n,
  },
  plainQuotes2: {
    estimate: 547290n,
    gasLimit: 656748n,
    transactionHash:
      '0x5e4994a2299f425f6267de77a3c9d8a4a965e6f529130b5290b78e4b13f4b15e',
    blockNumber: 68943177n,
  },
  provision4: {
    estimate: 783232n,
    gasLimit: 939879n,
    transactionHash:
      '0x2adc195bf81514bbb045bfc72196a65b24bc15a5e8802ca5b752d79efa0a6b59',
    blockNumber: 68940830n,
  },
  provision16: {
    estimate: 2223979n,
    gasLimit: 2668775n,
    transactionHash:
      '0xc99a3ed40d87d61429e9132e73df9afa220a02823c3a5ea22864ec19788e93ad',
    blockNumber: 68943504n,
  },
} as const satisfies Record<string, MeasuredGasSample>

// Protocol constant, not an S2 estimate.
export const nativeTransferGas = 21_000n
// Estimator INPUT ceiling proven in S2, not a gas limit to declare/pay.
// Default native-payout estimation produced anomalous 21,491,618 billed gas.
export const boundedEstimateGasCap = 2_000_000n
