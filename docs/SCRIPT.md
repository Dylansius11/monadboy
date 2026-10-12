# MONADBOY technical demo script

One recording session, one phone, about 2:50. Say it the way you would tell a friend, not read it. If a line feels stiff, say it your own way and keep the facts.

Hard limits: the main technical demo is 3 minutes at most. The optional Mera and Envio clips are 2 minutes at most each, and you cut them from this same footage (see the end).

The spoken lines add up to about 420 words, which is 2:50 at a relaxed pace. If your dry run goes over 3:00, cut the second sentence of block 4 and the last sentence of block 8 first.

## Before you hit record

- Worker health is green and `activePlayers` is 0: https://monadboy-api.43.129.38.115.sslip.io/v1/health
- Fresh browser profile, new passkey, so the first drip is available and every hash on screen is clean.
- Phone: Do Not Disturb, full battery, screen record with system sound on (the fill sound matters).
- Do one dry run first. Do not make the first run the one you keep.
- Desktop, next to you: a terminal with the Envio command below already typed, and the explorer open.
- Never say "flawless" or "organic users". Say TESTNET and DEMO x20 out loud at least once.

## The script

Each block is: when, what is on the screen, what you say.

### 1. Hook (0:00 to 0:14)

Screen: boot screen, TESTNET visible.

> Providing liquidity is the most important job in any market, and almost nobody learns it without losing money. So I turned it into a game you play on your phone. Real orders, fake money.

### 2. What it is (0:14 to 0:24)

Screen: the console, then CARTRIDGE select.

> This is MONADBOY, a pocket console on Monad testnet. The game is STAY IN RANGE.

### 3. One tap in (0:24 to 0:48)  [Mera]

Screen: INSERT CARD, passkey prompt, the three disks appear.

> No wallet, no seed phrase, no extension. I press INSERT CARD and tap my passkey once. That tap derives three separate save disks, each with its own address. From here signing is silent, so the game never stops to ask me. The keys live only in memory, and ejecting the card, or ten minutes in the background, wipes them.

### 4. Pick a market (0:48 to 1:02)

Screen: difficulty, then the pool tracker.

> I pick a difficulty. EASY, NORMAL and HARD filter which pools I may play, from calm to wild. The tracker maps real Kuru markets by safety and heat, and only books deep enough to play light up.

### 5. The ladder, four steps (1:02 to 1:30)  [Kuru]

Screen: SET RANGE, then the four-step checklist ticking through. Pause on the hashes.

> I choose how much and how wide. One tap and four real transactions run. Approve AUSD lets Kuru's margin account pull my tokens. Deposit moves them into margin. Zap buys the MON the ladder needs to sell. Provision places the whole ladder in one batch. Every order is linked to its flip, so when one fills, its pair re-arms on chain by itself.

### 6. Playing (1:30 to 2:05)  [Kuru, honesty]

Screen: live screen. Point at the black line, then the amber dashed TARGET line, then the IN RANGE / OUT OF RANGE badge, then SCORE and DAMAGE.

> This is live. The black line is the real TESTNET book price, where my orders fill. The amber dashed line is the target. A testnet market has no natural price action, so our bot mirrors the live mainnet MON price, amplified twenty times, and trades the book toward that target. It says DEMO x20 on every screen, and it is our bot, not organic users. When price moves through my ladder, fills flip and SCORE goes up. When it leaves my range, DAMAGE goes up, at the same size, because hiding the loss is how people get hurt.

### 7. The data (2:05 to 2:22)  [Envio]

Screen: cut to the desktop terminal. Run the command. Point at `isFlippedOrder`, the `tx` hash and `progressBlock`. Then the explorer with the same tx, then the leaderboard.

> Every fill is indexed by Envio. In our tests it showed up about half a second after the receipt. Here is the same fill from the public GraphQL, same hash. My SCORE and the leaderboard come from this index, never from the client.

### 8. Exit (2:22 to 2:34)

Screen: press B, the exit checklist, then results with the tx links.

> I press B. It cancels one order per linked pair, withdraws everything back to my disk, and shows results with every transaction linked.

### 9. The real test and the next games (2:34 to 2:55)  [Mera]

Screen: clear site data (or a private tab), open the app, INSERT CARD, the same three disks and the saved run come back.

> Now the test that matters. I clear all site data, INSERT CARD, same passkey. Same three disks, same save, decrypted on this phone from an encrypted record on chain. Nothing lives on a server. And this is only disk one. The same card will hold new games on real order books. This is MONADBOY.

## Cheat sheet if someone asks you what a thing is

- **Approve AUSD:** a one-time permission so Kuru's margin account can pull AUSD from your disk. Nothing moves yet.
- **Deposit AUSD:** moves the AUSD into your Kuru margin account.
- **Zap MON to margin:** buys MON with part of that AUSD, because a ladder needs MON to sell above the price and AUSD to buy below it.
- **Provision flip ladder:** places all the orders in one transaction. Each one is linked to a flip order at a nearby price, so a fill re-arms itself on chain, and each fill earns the spread.
- **Exit and re-center:** an exit and a fresh quote, never automatic. It cancels one ID per linked pair, withdraws, then shows a new ladder and fee before you confirm again. Use it when price walks out of your range.
- **Target:** where the DEMO price says the book should be. It starts at the book when a run begins, then follows mainnet MON times 20 while the bot trades the book toward it. The black line is what actually fills you, the amber dashed line is where it is headed.
- **Why a bot at all:** a testnet market has no natural price action, so without it nothing would ever fill. It is disclosed on every screen and in the README.
- **Why Monad:** fast blocks and cheap gas make a ladder of real orders and a live indexer feel instant on a phone.

## The Envio command

Run this on the desktop. It queries our public indexer, no key needed.

macOS, Linux, Git Bash:

```sh
curl -s https://monadboy-data.43.129.38.115.sslip.io/v1/graphql -H 'content-type: application/json' -d '{"query":"{ _meta { chainId progressBlock isReady } Fill(order_by:{block:desc}, limit:2){ block price size isFlippedOrder tx } }"}'
```

Windows PowerShell:

```powershell
Invoke-RestMethod https://monadboy-data.43.129.38.115.sslip.io/v1/graphql -Method Post -ContentType 'application/json' -Body '{"query":"{ _meta { chainId progressBlock isReady } Fill(order_by:{block:desc}, limit:2){ block price size isFlippedOrder tx } }"}' | ConvertTo-Json -Depth 6
```

No terminal? Paste the endpoint into a GraphQL client such as Hoppscotch and run the same query there.

For the cleanest shot, play first, then run it right after your last fill, so the newest `tx` is yours. Open that `tx` in the explorer to show the same hash.

## Cutting the sponsor clips from the same footage

You do not need to record again.

- **Mera clip, 2 minutes max:** blocks 3, 9, and the part of 5 where the checklist runs without a prompt. Keep the INSERT CARD tap, the silent signing, and the clear-data restore.
- **Envio clip, 2 minutes max:** blocks 6 and 7. Keep a fill happening, the query, the same hash in the explorer, and the leaderboard.
- If you run out of time, skip the sponsor clips. They are optional. The main video already carries both stories.
