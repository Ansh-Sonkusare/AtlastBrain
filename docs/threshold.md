# Novelty threshold

Written by `pnpm --filter web tune` (`apps/web/scripts/tune-threshold.ts`). Rerun it after you change the embedding model or the fixtures. Distance is cosine distance, `1 - cosine similarity`, from `Xenova/all-MiniLM-L6-v2`. A pair is predicted "same" when its distance is below the threshold.

## Result

- Pairs: 40 (20 same, 20 different).
- Same-pair distance: min 0.061, max 0.347. Different-pair distance: min 0.378, max 0.856.
- Best accuracy 1.000, reached for any threshold from 0.363 to 0.363.
- Chosen NOVELTY_MAX_DIST 0.36 (middle of that range): accuracy 1.000, precision 1.000, recall 1.000 (TP 20, FP 0, FN 0, TN 20).
- x402-overlap at 0.36 against user demo: 11 of 12 sentences right.

## Labelled pairs, nearest first

| dist | label | a | b |
| --- | --- | --- | --- |
| 0.061 | same | When vectors are normalized to unit length, the dot product equals the cosine similarity. | For unit-length vectors, the dot product is identical to cosine similarity. |
| 0.062 | same | A claim is a single checkable statement that expresses one fact or one idea. | A claim is one statement that can be checked and that carries a single idea. |
| 0.078 | same | The client puts the signed payment payload in the X-PAYMENT request header, encoded as base64. | The signed payment payload travels in the X-PAYMENT header of the retried request, in base64 encoding. |
| 0.078 | same | The redeem function burns an exact number of shares and sends back the corresponding assets. | Redeem burns a specified number of shares and returns the matching amount of assets. |
| 0.080 | same | The all-MiniLM-L6-v2 model maps sentences and short paragraphs to vectors with 384 dimensions. | The all-MiniLM-L6-v2 model turns a sentence or short paragraph into a 384-dimensional vector. |
| 0.083 | same | The top layers of an HNSW graph are sparse and contain long links that cover large distances. | Sparse upper layers of the HNSW graph hold long-range links that span big distances. |
| 0.085 | same | Each authorization includes a random nonce, so the token contract rejects any attempt to replay it. | Every authorization carries a random nonce, which stops the token contract from accepting a replayed copy. |
| 0.122 | same | Failed transactions inside a batch must be retried or split, otherwise one bad payment can block the others. | If one payment inside a batch fails, the batch must be retried or split so the remaining payments are not blocked. |
| 0.124 | same | Private transaction relays such as Flashbots Protect keep swaps out of the public mempool. | Flashbots Protect and similar private relays hide swaps from the public mempool. |
| 0.128 | same | Batching cuts per-call overhead because one blockchain transaction replaces dozens or hundreds of separate transfers. | Per-call overhead falls under batching, since a single blockchain transaction takes the place of many individual transfers. |
| 0.145 | same | The facilitator pays the network gas fee, so the paying client never needs a native gas token. | Because the facilitator covers the blockchain gas fee, the paying client does not have to hold a native gas token. |
| 0.163 | same | Chainlink price feeds aggregate prices from many independent node operators into a single on-chain value. | Chainlink feeds combine prices reported by several independent node operators and publish one value on chain. |
| 0.179 | same | Slippage is the difference between the price a trader expects and the price that the trade actually executes at. | Slippage describes how far the executed price of a trade ends up from the price the trader expected. |
| 0.220 | same | A high-water mark means the vault charges performance fees only on gains above the previous peak share price. | Performance fees under a high-water mark are charged only when the share price rises above the earlier peak. |
| 0.222 | same | A dishonest facilitator can still refuse to settle a payment or delay settlement for a long time. | Even an untrustworthy facilitator is able to withhold settlement or stall a payment for an extended period. |
| 0.242 | same | The x402 protocol lets software agents pay for web resources without accounts, API keys, or subscriptions. | With x402, an autonomous program can buy access to a web resource and skip signup, keys, and recurring plans. |
| 0.258 | same | The parameter M sets the maximum number of links that each node keeps in the HNSW graph. | In an HNSW graph, M caps how many connections each node can keep. |
| 0.278 | same | Each harvest costs gas, so the best harvest frequency balances compounding benefits against transaction costs. | Since every harvest burns gas, the ideal harvest interval trades compounding gains against transaction costs. |
| 0.301 | same | A common control is a per-request cap that rejects any payment requirement above a configured amount. | A typical safeguard is a cap per request that refuses any payment requirement exceeding a configured amount. |
| 0.347 | same | The verify endpoint checks a payment payload against payment requirements without sending any transaction on chain. | Verification through a facilitator checks a payload against the requirements and never broadcasts an on-chain transaction. |
| 0.378 | different | The efConstruction parameter sets the size of the candidate list used while inserting new vectors. | The efSearch parameter sets the candidate list size at query time and controls the recall and latency tradeoff. |
| 0.403 | different | The verify endpoint checks a payment payload against payment requirements without sending any transaction on chain. | The settle endpoint submits the authorized transfer to the blockchain and returns the transaction hash. |
| 0.468 | different | A vault share price equals total vault assets divided by total shares outstanding. | A management fee charges a small annual percentage of assets regardless of vault performance. |
| 0.484 | different | Batching groups many small payments into a single settlement transaction to spread the fixed cost. | Batched settlement delays final payment confirmation, so the seller carries credit risk during the batching window. |
| 0.543 | different | A facilitator cannot redirect funds, because the signed payment authorization fixes the recipient address and amount. | A dishonest facilitator can still refuse to settle a payment or delay settlement for a long time. |
| 0.546 | different | A facilitator is a service that verifies and settles x402 payments on behalf of resource servers. | The facilitator pays the network gas fee, so the paying client never needs a native gas token. |
| 0.594 | different | The top layers of an HNSW graph are sparse and contain long links that cover large distances. | Each node is assigned a maximum layer at random, with higher layers becoming exponentially less likely. |
| 0.607 | different | Each payment requirement names a network, an asset, a payTo address, and a maximum amount required. | The maxTimeoutSeconds field in a requirement limits how long a signed payment stays valid for settlement. |
| 0.613 | different | Larger batches lower the average gas cost per payment but increase the time before sellers receive funds. | A router can set different batching policies for different sellers based on call volume and trust level. |
| 0.652 | different | Chainlink feeds update when the price moves past a deviation threshold or when a heartbeat interval expires. | Each feed reports its own decimals value, and contracts must scale prices correctly before using them. |
| 0.676 | different | Cosine similarity measures the angle between two vectors and ignores their lengths. | Exact nearest neighbor search compares the query against every stored vector and scales linearly with collection size. |
| 0.698 | different | Constant product market makers such as Uniswap v2 keep the product of the two token reserves fixed. | Stablecoin pools use curves that flatten the price near parity, which lowers slippage for like-valued assets. |
| 0.698 | different | The parameter M sets the maximum number of links that each node keeps in the HNSW graph. | The efConstruction parameter sets the size of the candidate list used while inserting new vectors. |
| 0.728 | different | Contracts can compare the updatedAt timestamp from latestRoundData against the current block timestamp to detect staleness. | Layer-two networks need a check on the sequencer uptime feed so that prices are not trusted right after downtime. |
| 0.746 | different | A sandwich attack places a buy order before a victim swap and a sell order immediately after. | Private transaction relays such as Flashbots Protect keep swaps out of the public mempool. |
| 0.763 | different | The all-MiniLM-L6-v2 model truncates input text beyond 256 word pieces, so long documents must be split first. | The transformers.js library runs all-MiniLM-L6-v2 in Node or in the browser without a Python server. |
| 0.787 | different | The HTTP 402 Payment Required status code was reserved in the original HTTP specification but stayed unused for decades. | Payments in x402 are settled in stablecoins, with USDC as the most common asset. |
| 0.820 | different | Coinbase operates a hosted facilitator that supports USDC settlement on the Base network. | Any party can run an independent facilitator because the x402 specification defines the facilitator interface openly. |
| 0.843 | different | Settling every x402 payment as a separate on-chain transaction makes gas costs dominate very small payments. | Operators typically trigger a batch when it reaches a size limit or when a timer expires. |
| 0.856 | different | The 2022 Mango Markets exploit used a manipulated oracle price to borrow about 110 million dollars of assets. | Uniswap v3 stores cumulative tick observations that contracts can use to compute a TWAP over any recent window. |

## x402-overlap against the seeded demo user

Each sentence goes through `knownClaims` at the chosen threshold. "Nearest source" and "dist" come from the same query with no threshold, so a wrong prediction shows how far off it was.

| # | labelled | predicted | nearest source | dist | ok | sentence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | known | known | x402 Revives the HTTP 402 Payment Required Status Code | 0.242 | yes | With x402, an autonomous program can buy access to a web resource and skip signup, keys, and recurring plans. |
| 2 | known | known | x402 Revives the HTTP 402 Payment Required Status Code | 0.268 | yes | The signed payment payload travels in the X-PAYMENT header of the retried request, in base64 encoding. |
| 3 | new | new | x402 Revives the HTTP 402 Payment Required Status Code | 0.470 | yes | The x402 protocol also supports payments on the Solana network in addition to EVM chains. |
| 4 | known | known | What an x402 Facilitator Does | 0.145 | yes | Because the facilitator covers the blockchain gas fee, the paying client does not have to hold a native gas token. |
| 5 | known | known | The Facilitator HTTP Interface: Verify and Settle | 0.347 | yes | Verification through a facilitator checks a payload against the requirements and never broadcasts an on-chain transaction. |
| 6 | known | known | Trust and Fees in the Facilitator Model | 0.222 | yes | Even an untrustworthy facilitator is able to withhold settlement or stall a payment for an extended period. |
| 7 | new | known | The Facilitator HTTP Interface: Verify and Settle | 0.324 | NO | Payment requirements may include an outputSchema field that describes the format of the response from the paid endpoint. |
| 8 | known | known | Batching Micropayments in x402 | 0.128 | yes | Per-call overhead falls under batching, since a single blockchain transaction takes the place of many individual transfers. |
| 9 | known | known | Latency Versus Cost When Batching Agent Payments | 0.122 | yes | If one payment inside a batch fails, the batch must be retried or split so the remaining payments are not blocked. |
| 10 | known | known | Settlement of x402 Payments on Base | 0.085 | yes | Every authorization carries a random nonce, which stops the token contract from accepting a replayed copy. |
| 11 | new | new | x402 Revives the HTTP 402 Payment Required Status Code | 0.403 | yes | The x402 Bazaar is a discovery catalog where agents can find paid endpoints to call. |
| 12 | known | known | Budgets and Spending Limits for Agent Payments | 0.301 | yes | A typical safeguard is a cap per request that refuses any payment requirement exceeding a configured amount. |

## Notes

- Set `NOVELTY_MAX_DIST=0.36`. The code default in `pipeline/deps.ts` is still 0.35. G2 did not change pipeline code, so the lead decides whether to move the default.
- The margin is thin. The loosest same pair is 0.347 and the closest different pair is 0.378, so only 0.347 to 0.378 separates the labels and 0.36 sits inside it.
- On x402-overlap, sentence 7 (outputSchema) is the one miss. It lies 0.324 from the verify and settle article, nearer than sentence 5 (0.347), which must count as known. No threshold gets both right.
