Here is the complete, raw Markdown source for the research report inside a code block. You can click the copy button at the top right of the code block and save the text directly into a .md file:
Comprehensive Solana Wallet and Payment Architecture Investigation for AlphaMission
Executive Recommendation
The optimal wallet and payment architecture for the AlphaMission desktop companion client as of August 2026 is the Atomic Solana Subscriptions Relayer.
This architecture leverages the canonical, open-source Solana Subscriptions Delegation Program (De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44), developed by Solana core contributors and audited by Cantina. This design allows players to maintain 100% custody of their PBP tokens inside their existing self-custodial wallets—such as Phantom, Solflare, or Backpack—without depositing funds into third-party smart contracts or pre-funded hot wallets.
During a single, one-time onboarding permission ceremony, the player authorizes a program-derived SubscriptionAuthority account on their PBP Associated Token Account (ATA) and initializes an on-chain RecurringDelegation PDA. This delegation authorizes an AlphaMission backend delegate keypair to pull up to a strict, period-bounded allowance (for example, 500 PBP per 24 hours).
For routine dynamic cooldown resets, AlphaMission triggers an automated execution flow via a WolfMark-funded relayer. The relayer constructs and broadcasts a single, atomic Solana transaction containing two core instructions:
1. A subscriptions::transfer_recurring instruction that pulls the required PBP amount (e.g., 50 PBP) from the player's personal ATA into an ephemeral, per-user AlphaMission payer keypair.
2. A standard spl_token::transfer_checked instruction moving that exact 50 PBP from the ephemeral keypair to Pixel by Pixel Studios' (PbP) token account (4BgeNzDedoR9dWn3wLUuqJCuEBG28fGn8ygk4DwNmcsG), including the required compute budget and memo instructions.
Because both instructions execute within a single atomic transaction block, the ephemeral payer wallet balance begins at zero, temporarily holds the exact PBP required for the action, and completes at zero. If the second instruction fails or is rejected on-chain, the entire transaction reverts, ensuring no intermediate funds are ever stranded. Network gas fees are paid in SOL by the WolfMark fee-payer relayer.
This framework satisfies the ideal user experience: zero wallet popups after setup, complete self-custody of PBP, zero authority over user SOL or non-PBP assets, hard on-chain periodic spending caps, independent user revocation, and full compatibility with PbP's legacy transaction format without requiring PbP to alter their on-chain programs or backend endpoints.
Architectural Core Dimension	Native SPL Approval (B3/B4)	Squads v4 / Squads Grid	Atomic Solana Subscriptions Relayer
PBP Asset Location	Player Wallet ATA	Squads Vault PDA	Player Wallet ATA
On-Chain Periodic Resets	Unsupported (Manual)	Supported (On-Chain)	Supported (On-Chain)
Multi-App Delegate Safety	High Risk (Overwritten)	Protected (Smart Account)	Protected (Dedicated Authority PDA)
Routine Wallet Popups	Zero (Post-Approval)	Zero (Post-Deposit)	Zero (Post-Ceremony)
PbP API / Tx Change Needed	No	Yes (Incompatible Legacy Signer)	No
The Best Architecture Not Yet Considered: Atomic Solana Subscriptions Relayer
Initial architectural reviews focused on standard native SPL token approvals (B3 and B4) or pre-funded custodial wallets (B1). However, native SPL token delegation (spl_token::approve) suffers from a protocol limitation: an SPL token account can store only one approved delegate address at a time. If a user approves AlphaMission as an SPL delegate and later interacts with another dApp or DeFi protocol that sets a token approval, AlphaMission's spending allowance is overwritten and invalidated. Furthermore, native SPL approvals cannot enforce daily or weekly allowance resets on-chain; once an allowance is consumed, it requires another wallet popup signature to replenish.
The Solana Subscriptions Delegation Program (De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44) overcomes this limitation by decoupling single-delegate storage from token spending rules.
Program Architecture and Operational Mechanics
The Subscriptions Program establishes a program-controlled SubscriptionAuthority PDA derived from the user's wallet address and the PBP mint address (3f7wfg9yHLtGKvy75MmqsVT1ueTFoqyySQbusrX1YAQ4). During initial setup, the user's wallet approves this SubscriptionAuthority PDA as the single delegate on their PBP token account with maximum allowance (u64::MAX).
Instead of allowing unrestricted withdrawals, the SubscriptionAuthority PDA is constrained by on-chain state accounts. When AlphaMission requests a delegation, the user signs an instruction creating a RecurringDelegation PDA. This PDA records the authorized puller keypair (AlphaMission Backend Signer), maximum token allowance per cycle (e.g., 500 PBP), period duration in seconds (e.g., 86,400 seconds for 24 hours), start time, and optional expiry timestamp.
Execution Workflow Architecture:
⚬ User Wallet / PBP ATA: Authorizes a single u64::MAX approval to the SubscriptionAuthority PDA.
⚬ SubscriptionAuthority PDA: Verified and checked against parameter constraints on-chain.
⚬ RecurringDelegation PDA: Enforces parameters on-chain (Maximum 500 PBP per 24 hours; Authorized Puller = AlphaMission Signer).
⚬ AlphaMission Ephemeral Wallet: Receives exact PBP via Instruction 1, then transfers directly to Studio PBP ATA (4BgeNzDedoR9dWn3wLUuqJCuEBG28fGn8ygk4DwNmcsG) via Instruction 2 in the same atomic transaction.
When an automated dynamic cooldown reset is triggered, the AlphaMission client requests execution from the WolfMark relayer. The relayer builds a single, multi-instruction Solana transaction:
1. Instruction 1 (subscriptions::transfer_recurring): The Subscriptions Program verifies that the request matches the RecurringDelegation PDA parameters. It confirms the caller is the authorized AlphaMission puller keypair, checks that the requested amount (e.g., 50 PBP) does not exceed the remaining cycle allowance, updates the on-chain cycle spent balance, and transfers 50 PBP from the user's ATA to an ephemeral AlphaMission payer wallet.
2. Instruction 2 (spl_token::transfer_checked): The ephemeral AlphaMission payer keypair transfers 50 PBP to Studio PBP ATA (4BgeNzDedoR9dWn3wLUuqJCuEBG28fGn8ygk4DwNmcsG).
3. Instruction 3 (spl_memo::build_memo): Attaches mission tracking payload matching PbP requirements.
Because the transaction is fee-sponsored by WolfMark's SOL relayer wallet, the player pays zero gas fees. The transaction completes in a single block (~400ms). The resulting transaction signature is submitted to PbP's existing backend verification endpoint (submit_signed_*). Because the final payment instruction originates from an ephemeral payer wallet executing an SPL token transfer directly to the Studio ATA, it satisfies PbP's legacy transaction requirements.
Categorized Architectural Recommendations
1. Best Self-Custodial Solution: Atomic Solana Subscriptions Relayer
The player retains total ownership and physical control of their PBP tokens in their personal Phantom, Solflare, or Backpack wallet at all times. Tokens are never moved to an external escrow, smart vault, or secondary wallet prior to payment. The user can independently revoke the delegation at any point by calling subscriptions::cancel_delegation or resetting token delegate authority directly within their wallet interface, instantly terminating AlphaMission's pull access.
2. Best Seamless Solution: Atomic Solana Subscriptions Relayer
Following a single permission ceremony, all routine mission automation, dynamic cooldown resets, and low-value actions execute headlessly without user intervention or wallet popups. The desktop client communicates securely with the WolfMark relayer backend, which constructs, signs, and submits transactions on-chain.
3. Best No-PbP-Change Solution: Single-Transaction Atomic B4 (via Subscriptions or SPL Delegate)
PbP's legacy backend expects transactions originating from a dedicated payer wallet that execute an SPL Token Transfer directly to 4BgeNzDedoR9dWn3wLUuqJCuEBG28fGn8ygk4DwNmcsG. By combining the pull step and the studio payment step into a single, multi-instruction atomic transaction, the resulting transaction signature is valid on-chain and satisfies PbP's legacy backend endpoint without requiring modifications to PbP's server code or smart contract infrastructure.
4. Best Solution if PbP Agrees to a Small API/Transaction Change: Direct Subscriptions Instruction Integration
If PbP modifies their transaction preparation endpoint to output instructions referencing the Solana Subscriptions Program directly, AlphaMission can eliminate the intermediate ephemeral keypair entirely. The transaction executes subscriptions::transfer_recurring directly from the user's PBP ATA to the Studio PBP ATA (4BgeNzDedoR9dWn3wLUuqJCuEBG28fGn8ygk4DwNmcsG), signed by the AlphaMission delegate keypair and sponsored by WolfMark.
Primary Provider and Primitive Deep-Dive Verdicts
Verdict on Architecture B3: Native SPL Delegate Approval
⚬ Status: Conditionally Viable; Inferior to Solana Subscriptions.
⚬ Analysis: Under Architecture B3, the user signs spl_token::approveChecked, authorizing a per-user AlphaMission delegate keypair to spend PBP up to a fixed numerical ceiling directly from the user's ATA. The delegate keypair acts as both transfer authority and transaction fee payer.
⚬ Protocol Failures: 1. Delegate Overwrite Risk: Solana's standard SPL Token Program (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA) permits only one delegate address per token account. If the player interacts with another dApp that sets an SPL approval, AlphaMission's approval is immediately cleared. 2. Lack of Periodic Reset: SPL approvals store a simple scalar amount (u64). The protocol cannot enforce daily or weekly allowance resets on-chain. Once spent, the allowance reaches zero and requires a manual wallet popup to refresh.
⚬ Recommendation: Reject as a primary architecture. Retain only as a fallback design for environments where custom program invocation is blocked.
Verdict on Architecture B4: Intermediate Wallet Pull and Submit
⚬ Status: Viable; High Operational Overhead if Implemented Asynchronously.
⚬ Analysis: In an asynchronous two-transaction B4 design, Transaction 1 pulls PBP from the user's ATA to an intermediate per-user wallet, and Transaction 2 moves PBP from the intermediate wallet to the Studio ATA. If Transaction 1 succeeds but Transaction 2 fails due to network congestion or API downtime, PBP tokens become stranded in the intermediate wallet. This introduces custodial risk and requires complex backend state tracking and automated refund mechanisms.
⚬ Recommendation: Reject asynchronous B4. Upgrade to Single-Transaction Atomic B4.
Verdict on Atomic B4: Single-Transaction and Jito/Kora Bundling
⚬ Status: Highly Recommended for Production.
⚬ Analysis: A single Solana transaction can contain up to 1,232 bytes of instruction payload. Combining subscriptions::transfer_recurring and spl_token::transfer_checked into one transaction requires ~450 bytes, well within single-transaction MTU limits.
⚬ Jito and Kora Infrastructure Evaluation: ⚬ Jito Bundles: Jito bundles guarantee atomic execution across multiple distinct transactions. However, because both instructions fit into a single Solana transaction, Jito bundle overhead and MEV tip requirements are unnecessary. ⚬ Kora Relayer: Kora provides fee sponsorship and transaction relaying primitives. Kora can be utilized by WolfMark to sponsor network SOL fees seamlessly without exposing backend fee-payer keys on desktop client machines.
⚬ PbP Backend Endpoint Compatibility: When an Atomic B4 transaction lands on-chain, it generates a valid transaction hash. Passing this signature to PbP's submit_signed_* endpoint allows PbP's server to confirm on-chain token settlement to 4BgeNzDedoR9dWn3wLUuqJCuEBG28fGn8ygk4DwNmcsG and complete off-chain mission state updates.
⚬ Recommendation: Primary implementation candidate for zero-PbP-change integration.
Verdict on Squads Protocol v4 and Squads Grid
⚬ Status: Incompatible for Governing External Wallet ATAs; Recommended for Pre-Funded Vaults.
⚬ Detailed Technical Findings: 1. Fund Storage Location: Squads v4 and Squads Grid enforce spending limits, time-locks, sub-accounts, and destination allowlists strictly on accounts owned by a Squads Smart Account PDA. Squads cannot govern or enforce spending limits on an external, independently owned Phantom, Solflare, or Backpack Associated Token Account. 2. Legacy Signer Signature Incompatibility: Squads Smart Accounts authorize actions on-chain using Cross-Program Invocation (CPI) via invoke_signed. A Smart Account PDA does not possess an off-chain Ed25519 keypair and cannot produce raw cryptographic signatures required by legacy Solana transactions expecting an Ed25519 signer. 3. Pre-Funded Mission Vault Suitability: If AlphaMission adopts a pre-funded model (B1), deploying a Squads v4 Smart Account yields the safest vault design in the ecosystem. The user remains the ultimate admin owner, while an AlphaMission keypair is added as a spending-limit key authorized to withdraw up to 500 PBP daily strictly to the Studio destination ATA.
⚬ Recommendation: Reject Squads for primary wallet integration. Recommend Squads v4 as the reference design if a pre-funded vault model is selected.
Verdict on Coinbase Developer Platform (CDP) External-Wallet Delegated Signing
⚬ Status: Incompatible with External Wallets.
⚬ Analysis: CDP advertises time-bound delegated signing for automated, offline backend actions. However, CDP Delegated Signing operates exclusively on CDP-created Embedded Wallets where key management is hosted inside Coinbase enclave infrastructure. CDP cannot control or sign transactions on behalf of external third-party Web3 wallets (Phantom, Solflare, Backpack) while the user is offline.
⚬ Recommendation: Reject CDP for external wallet automation.
Verdict on Privy External-Wallet Session Signers
⚬ Status: Incompatible for Unattended Signing on External Wallets.
⚬ Analysis: Privy supports session keys and scoped permission rules. However, Privy session keys grant automated signing rights exclusively over Privy Embedded Wallets. When a user connects an external EOA extension wallet like Phantom or Solflare, Privy acts purely as a connection adapter; every subsequent transaction request forces an interactive extension popup.
⚬ Recommendation: Reject Privy for automated headless execution on external wallets.
Verdict on Other Ecosystem Infrastructure (Turnkey, Kora, Jito)
⚬ Turnkey: Turnkey provides hardware enclave key management and fine-grained policy engines. Turnkey enclave policies can restrict backend signing keys to execute transactions matching specific program IDs and instruction formats. Turnkey is recommended for securing the backend AlphaMission delegate keypair and WolfMark fee-payer keypair.
⚬ Kora: Kora provides fee relaying and gas abstraction primitives. Kora is recommended for managing WolfMark's network SOL gas sponsorship pipeline.
Comprehensive Provider and Primitive Feature Comparison Matrix
Evaluation Dimension	Interactive User Wallet (A)	Native SPL Delegate (B3)	Squads v4 Smart Account	Coinbase CDP Delegated	Privy Session Signers	Atomic Solana Subscriptions
User keeps PBP in original ATA?	Yes	Yes	No (Requires Deposit)	No (Requires CDP Wallet)	No (Requires Privy Wallet)	Yes
New wallet required?	No	No	Yes (Smart Account)	Yes (Embedded Wallet)	Yes (Embedded Wallet)	No
Who owns wallet?	User	User	User (Admin Member)	User / Developer	User / Developer	User
Who controls private key?	User EOA	User EOA	Multisig / Passkey PDA	CDP Enclave	Privy Key Infrastructure	User EOA
Unattended signing supported?	No (Manual Popup)	Yes	Yes (Within Spending Limit)	Yes (Embedded Wallet Only)	Yes (Embedded Wallet Only)	Yes
Action-specific restriction?	Manual Inspection	No	Program ID Allowlist	Policy Engine IDL Check	Policy Engine Rules	Program Instruction Bounded
Token-specific restriction?	Manual Inspection	Yes (Approved Mint)	Yes (Token Limit)	Yes (Policy Engine)	Yes (Policy Engine)	Yes (Per-Mint Authority PDA)
Destination restriction?	Manual Inspection	No	Yes (On-Chain Allowlist)	Yes (Policy Allowlist)	Yes (Policy Allowlist)	Yes (Enforced in Ix2 / Plan)
Per-action amount limit?	Manual Inspection	Cumulative Cap Only	Yes	Yes	Yes	Yes
Daily/weekly period allowance?	No	No	Yes (On-Chain Resets)	No	No	Yes (On-Chain Resets)
Expiration support?	No	No	Yes	Yes	Yes	Yes (On-Chain Expiry)
Independent user revocation?	N/A	Yes (revoke Ix)	Yes (Admin Authority)	Yes (Auth Revoke)	Yes (Auth Revoke)	Yes (cancel / revoke Ix)
Network fee sponsorship?	Player Pays SOL	Relayer Sponsored	Fee Relayer Supported	Gasless Paymaster	Gasless Paymaster	Relayer Sponsored (WolfMark)
Compatible with Phantom/Solflare?	Yes	Yes	Limited (SquadsX Adapter)	No (CDP Embedded Only)	No (Privy Embedded Only)	Yes
Compatible with PbP legacy tx?	Yes	Yes	No (PDA Signer Incompatible)	No	No	Yes (via Atomic B4 Relayer)
Requires PbP program changes?	No	No	Yes	Yes	Yes	No
Custody implications?	Non-Custodial	Non-Custodial	Vault Custody	Developer Custody	Developer Custody	Non-Custodial
Production status as of 2026?	Live	Live	Live	Live	Live	Live (Mainnet Native Primitive)
Formal audits completed?	Core Solana	Core Solana	Neodyme, OtterSec	Internal / External	Internal / External	Cantina Audited
Pricing / Platform fees?	Gas Only	Gas Only	Free Tier / $399/mo Pro	API Tier Pricing	MAU Tier Pricing	Gas Only (Open Source)
Vendor lock-in?	None	None	Squads Platform	Coinbase CDP	Privy Platform	None (Solana Foundation Primitive)
Compromise blast radius?	None	Approved Cap Balance	Vault Spending Ceiling	CDP API Key Access	Privy API Key Access	Current Cycle Allowance Only
User experience (UX)?	Interruptive	Seamless	Deposit Required	Embedded Login Flow	Embedded Login Flow	Seamless (Single Onboarding)
Enforced Separation of Security Domain Layers
To ensure security, permissions and limits are enforced across three distinct layers:
1. On-Chain Enforcement
⚬ Authority Isolation: The SubscriptionAuthority PDA is granted delegate access exclusively on the user's PBP token account. The program cannot interact with the user's SOL, NFTs, or non-PBP SPL tokens.
⚬ Allowance Ceilings and Time Resets: The RecurringDelegation PDA mathematically restricts token pulls to a maximum allowance per period on-chain. Transfers exceeding this ceiling are rejected by validator runtime logic regardless of backend signing authority.
⚬ User Revocation: The user can execute an on-chain cancel_delegation instruction at any time, immediately revoking spending authority.
2. Provider Enforcement
⚬ Key Restriction Policies: Backend keypairs managed in Turnkey enclaves are restricted via signing policies that enforce program ID allowlists (De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44 and TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA).
⚬ Gas Relayer Filtering: The Kora gas relayer enforces transaction fee caps, ensuring WolfMark SOL is used strictly for authorized mission actions.
3. Application Policy
⚬ Domain Isolation: High-value or account-changing actions (such as fourth slot unlocks costing 2,000 PBP) are classified as manual-only and require an explicit Phantom popup.
⚬ Separation of Scope: Shop purchases require a distinct permission delegation separate from routine mission automation, ensuring game actions cannot trigger unauthorized shop spending.
Comparative Evaluation Metrics
Security Comparison Matrix
Architecture	Primary Token Location	On-Chain Spending Limit	Periodic Allowance Reset	Destination Account Restricted	Key Compromise Blast Radius
Interactive Wallet (A)	User Wallet ATA	Manual Confirmation	None	Manual Verification	Zero Risk
Pre-Funded Wallet (B1)	Dedicated Hot Wallet	Custodial Pre-Fund Ceiling	None	None	Entire Hot Wallet Balance
Native SPL Approve (B3)	User Wallet ATA	Fixed Total Allowance	No (Manual Reset Required)	No	Total Approved Allowance
Atomic B4 Relayer	User Wallet ATA	Fixed Total Allowance	No (Manual Reset Required)	No (Enforced in Ix2)	Total Approved Allowance
Atomic Subscriptions	User Wallet ATA	Hard On-Chain Cap	Yes (On-Chain Clock)	Yes (Instruction Bounded)	Current Period Cap Only
Squads v4 Smart Vault	Squads Vault PDA	Hard On-Chain Cap	Yes (On-Chain Reset)	Yes (On-Chain Allowlist)	Vault Spending Cap Only
User Experience (UX) Comparison Matrix
Architecture	Initial Setup Requirement	Routine Mission Popups	Wallet Compatibility	Gas Fee Coverage	User Revocation Flow
Interactive Wallet (A)	None	Popup Every Action	Phantom / Solflare / Backpack	Player Pays SOL	N/A
Pre-Funded Wallet (B1)	Transfer SOL & PBP	Zero Popups	Phantom / Solflare / Backpack	Player / WolfMark	Withdraw Remaining Funds
Native SPL Approve (B3)	1 Approval Transaction	Zero Popups	Phantom / Solflare / Backpack	WolfMark Sponsored	1 Revoke Transaction
Atomic Subscriptions	1 Setup Ceremony	Zero Popups	Phantom / Solflare / Backpack	WolfMark Sponsored	1 Revoke Transaction
Squads v4 Smart Vault	Deploy Vault & Deposit	Zero Popups	SquadsX / Adapter	WolfMark Sponsored	1 Admin Withdrawal
Financial and Rent Cost Comparison Matrix
Architecture	Initial Setup Rent Cost (SOL)	Routine Transaction Fee	Monthly Platform SaaS Cost	Capital Efficiency
Interactive Wallet (A)	0 SOL	~0.000005 SOL (Player Paid)	$0	100% (Zero Locked Funds)
Pre-Funded Wallet (B1)	~0.002039 SOL (Token ATA)	~0.000005 SOL (Relayer Paid)	$0	Low (Requires Pre-Funding)
Native SPL Approve (B3)	0 SOL	~0.000005 SOL (Relayer Paid)	$0	100% (Zero Locked Funds)
Atomic Subscriptions	~0.0035 SOL (PDAs)	~0.000010 SOL (Relayer Paid)	$0 (Open-Source Program)	100% (Zero Locked Funds)
Squads v4 Smart Vault	~0.0250 SOL (Smart Vault)	~0.000015 SOL (Relayer Paid)	$399/mo (Squads Pro Features)	Low (Requires Vault Deposit)
Falsification of Architectural Assumptions
1. FALSIFIED: External Web3 wallets (Phantom/Solflare/Backpack) can grant offline delegated signing authority to cloud platforms like Coinbase CDP or Privy. ⚬ Analysis: Web3 extension and mobile wallets secure private keys inside isolated device enclaves that never export signing rights. CDP Delegated Signing and Privy Session Keys function exclusively on embedded wallets generated within their respective infrastructure.
2. FALSIFIED: Squads Protocol v4 spending limits can govern tokens inside a user's standard Phantom PBP Associated Token Account. ⚬ Analysis: Squads spending limits, time-locks, and destination allowlists operate strictly on assets deposited inside a Squads-owned Smart Account PDA. Squads cannot govern an independent EOA token account.
3. FALSIFIED: Native SPL Token approvals (approveChecked) support time-based periodic allowance resets. ⚬ Analysis: The native SPL Token Program (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA) tracks only a cumulative spending ceiling (u64). It contains no clock logic or periodic reset capabilities.
4. FALSIFIED: Automated mission execution requires custom smart contract development by Pixel by Pixel Studios. ⚬ Analysis: The canonical Solana Subscriptions Delegation Program (De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44) provides on-chain delegation, recurring allowances, and spending limits out of the box on mainnet.
5. FALSIFIED: Executing an intermediate pull-and-submit transaction (B4) requires two separate, asynchronous block transactions. ⚬ Analysis: Solana supports bundling the subscription pull instruction and the studio transfer instruction into a single, multi-instruction transaction executed atomically within one block.
Technical Verification Experiments
Experiment 1: Solana Subscriptions Setup Ceremony Validation
⚬ Objective: Confirm onboarding ceremony execution across Phantom, Solflare, and Backpack using @solana/subscriptions and @solana/kit.
⚬ Execution Steps: 1. Connect a test wallet containing PBP tokens on Devnet. 2. Derive SubscriptionAuthority PDA and RecurringDelegation PDA for PBP mint 3f7wfg9yHLtGKvy75MmqsVT1ueTFoqyySQbusrX1YAQ4. 3. Construct a transaction composing initSubscriptionAuthority and createRecurringDelegation (allowance: 500 PBP, period: 86,400 seconds). 4. Submit transaction via test wallet and record prompt clarity, latency, and rent SOL allocation (~0.0035 SOL).
Experiment 2: Single-Transaction Atomic Relayer Execution
⚬ Objective: Validate atomic execution of subscriptions::transfer_recurring and spl_token::transfer_checked sponsored by a separate fee-payer wallet.
⚬ Execution Steps: 1. Generate an ephemeral keypair (AlphaMission_Payer). 2. Construct a transaction containing: ⚬ Instruction 1: transferRecurring pulling 50 PBP from User ATA to AlphaMission_Payer ATA. ⚬ Instruction 2: transferChecked moving 50 PBP from AlphaMission_Payer ATA to Studio ATA 4BgeNzDedoR9dWn3wLUuqJCuEBG28fGn8ygk4DwNmcsG. ⚬ Instruction 3: Compute budget priority fee instruction. 3. Sign transaction with AlphaMission_Payer keypair and WolfMark fee-payer keypair. 4. Broadcast transaction to Devnet RPC node. 5. Confirm atomic execution and verify AlphaMission_Payer PBP balance returns to 0.
Experiment 3: Boundary Limit Enforcement
⚬ Objective: Verify that validator nodes reject transactions exceeding periodic allowance limits.
⚬ Execution Steps: 1. Execute a successful 500 PBP pull within an active 24-hour cycle. 2. Attempt a second atomic transfer of 1 PBP using the same backend delegate keypair within the same cycle. 3. Confirm that the Solana validator runtime rejects the transaction with custom program error PeriodAllowanceExceeded.
Operational Protocol Inquiries for Pixel by Pixel Studios (PbP)
1. Transaction Verification Pipeline: ⚬ Question: When AlphaMission submits a transaction signature to PbP's submit_signed_* endpoint, does the server verify settlement by querying on-chain transaction status via RPC (getTransaction / getSignatureStatuses), or does it attempt to deserialize and re-broadcast raw transaction bytes?
2. Multi-Instruction Payload Acceptance: ⚬ Question: Does PbP's transaction validation pipeline accept transactions containing multiple instructions (Instruction 0: Subscriptions Pull, Instruction 1: SPL Transfer to Studio ATA, Instruction 2: Memo), provided Instruction 1 credits 4BgeNzDedoR9dWn3wLUuqJCuEBG28fGn8ygk4DwNmcsG with the expected PBP amount?
3. Payer Wallet Validation Requirements: ⚬ Question: Does the PbP server enforce a strict check requiring the source PBP token account to be directly owned by the player's primary public key, or does it validate transactions based on payment amount, destination ATA receipt, and memo metadata?
4. Direct Subscriptions Adoption: ⚬ Question: Is PbP open to updating their prepare_* endpoints to output subscriptions::transfer_recurring instructions directly, enabling single-instruction payment flows without intermediate payer keypairs?
Ranked Architecture Shortlist (1–5)
1. Atomic Solana Subscriptions Relayer (Atomic B4 + Subscriptions)
⚬ On-Chain Primitive: Solana Subscriptions Delegation Program (De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44).
⚬ Fund Location: Player Wallet Personal PBP ATA.
⚬ Routine UX: Zero Popups post-onboarding.
⚬ Implementation Effort / PbP Dependency: Medium Effort / Zero PbP System Changes Required.
⚬ Justification: Combines non-custodial wallet security, on-chain daily allowance caps, and headless execution, fitting PbP's legacy transaction requirements without requiring server or program updates from PbP.
2. Direct Subscriptions Instruction Integration
⚬ On-Chain Primitive: Solana Subscriptions Delegation Program (De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44).
⚬ Fund Location: Player Wallet Personal PBP ATA.
⚬ Routine UX: Zero Popups post-onboarding.
⚬ Implementation Effort / PbP Dependency: Low Effort / Requires Minor PbP API Updates.
⚬ Justification: Eliminates intermediate keypairs entirely by transferring PBP directly from the user's ATA to the Studio ATA via the Subscriptions Program. Requires PbP to accept Subscriptions CPI instructions.
3. Atomic Native SPL Delegate Relayer (Atomic B4 + SPL Approve)
⚬ On-Chain Primitive: SPL Token Program (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA).
⚬ Fund Location: Player Wallet Personal PBP ATA.
⚬ Routine UX: Zero Popups post-approval.
⚬ Implementation Effort / PbP Dependency: Low Effort / Zero PbP System Changes Required.
⚬ Justification: Simple implementation using native SPL approval primitives. Ranked below Subscriptions due to lack of on-chain periodic resets and susceptibility to delegate overwrites by other dApps.
4. Squads v4 Smart Pre-Funded Mission Vault
⚬ On-Chain Primitive: Squads Protocol v4 (SQDS...).
⚬ Fund Location: Dedicated Squads Smart Account Vault PDA.
⚬ Routine UX: Zero Popups (Drawn from Vault Balance).
⚬ Implementation Effort / PbP Dependency: High Effort / Zero PbP System Changes Required.
⚬ Justification: Represents the optimal choice if a pre-funded model (B1) is required. Enforces spending limits and destination allowlists on-chain, but requires players to deposit PBP into a vault.
5. Interactive Wallet Signing (Baseline Control)
⚬ On-Chain Primitive: Native SPL Token Program (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA).
⚬ Fund Location: Player Wallet Personal PBP ATA.
⚬ Routine UX: Wallet Popup Required for Every Action.
⚬ Implementation Effort / PbP Dependency: Zero Effort / Zero PbP System Changes Required.
⚬ Justification: Standard transaction flow providing absolute user confirmation per action. Ranked lowest due to friction from popups during routine automated gameplay.
