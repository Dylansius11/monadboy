export const ausdFaucetAbi = [
  {
    type: 'function', name: 'requestFunds', stateMutability: 'nonpayable',
    inputs: [{ name: 'recipient', type: 'address' }], outputs: [],
  },
  {
    type: 'function', name: 'token', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'address' }],
  },
  { type: 'error', name: 'MaxFrequencyExceeded', inputs: [] },
] as const
