// This signature requests bounded TESTNET market activity, never transaction authority.
export function mirrorDemandMessage(market: string, owner: string, at: number): string {
  return `MONADBOY mirror demand\nchain:10143\nmarket:${market.toLowerCase()}\nowner:${owner.toLowerCase()}\nat:${at}`
}
