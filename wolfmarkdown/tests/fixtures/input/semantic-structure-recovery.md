# Synthetic Wallet Payment Architecture Report

## Executive Recommendation

The recommended design combines a user-controlled wallet with a recurring delegation and a sponsored relayer. The source intentionally omits blank lines between several conceptual blocks so the repair agent must recover them. The protected identifiers are test_program_id_001, test_mint_address_001, test_destination_ata_001, test_token_program_001, subscriptions::transfer_recurring, spl_token::transfer_checked, spl_token::approveChecked, SubscriptionAuthority, RecurringDelegation, u64::MAX, submit_signed_*, getTransaction, and getSignatureStatuses. Architectural Core Dimension Manual Token Approval Policy Vault Recurring Delegation Asset Location User Wallet ATA Vault PDA User Wallet ATA Periodic Reset Unsupported Supported Supported Destination Control Manual Review Allowlist Instruction Bound Program Architecture and Operational Mechanics The authority account is derived from the user's wallet and test_mint_address_001. The recurring account stores an authorised puller, a period allowance, and an expiry. The approval uses u64::MAX while the recurring account enforces the effective limit. Execution Workflow Architecture ⚬ Status: Synthetic flow only. ⚬ Analysis: One atomic transaction combines subscriptions::transfer_recurring with spl_token::transfer_checked. ⚬ Recommendation: Keep the user wallet as the source and use test_destination_ata_001 as the fixed destination.

1. Create the delegation.
2. Submit the sponsored transaction.
3. Confirm getTransaction and getSignatureStatuses.

## Primary Provider and Primitive Deep-Dive Verdicts

### Verdict on Architecture B3: Manual Token Approval

⚬ Status: Conditionally viable. ⚬ Analysis: spl_token::approveChecked grants a single delegate and does not provide a recurring clock reset. ⚬ Protocol Failures: Delegate replacement and manual replenishment remain possible. ⚬ Recommendation: Use only as a fallback.

### Verdict on Architecture B4: Intermediate Wallet Pull and Submit

⚬ Status: Operationally risky. ⚬ Analysis: A failed second transaction can strand funds in the intermediate wallet. ⚬ Recommendation: Prefer a single atomic transaction.

### Verdict on Atomic B4: Single-Transaction Bundling

⚬ Status: Recommended for this synthetic comparison. ⚬ Analysis: The two transfers fit within one transaction and preserve the destination constraint. ⚬ Recommendation: Keep the payment and pull steps atomic.

### Verdict on Policy Vault

⚬ Status: Suitable only for a pre-funded model. ⚬ Detailed Technical Findings: The vault can enforce an allowlist for its own balance but cannot govern an unrelated user ATA. ⚬ Recommendation: Do not use it as the default external-wallet integration.

### Verdict on Provider A

⚬ Status: Embedded-wallet only. ⚬ Analysis: The provider controls only wallets created inside its own platform. ⚬ Recommendation: Reject for external-wallet automation.

### Verdict on Provider B

⚬ Status: Interactive for external wallets. ⚬ Analysis: Session permissions do not remove the user approval prompt. ⚬ Recommendation: Reject unattended execution.

### Verdict on Other Infrastructure

⚬ Status: Relayer and key-policy components remain useful. ⚬ Analysis: Provider policies should allow only test_program_id_001 and test_token_program_001. ⚬ Recommendation: Keep infrastructure controls separate from application policy.

## Comprehensive Provider and Primitive Feature Comparison Matrix

Evaluation Dimension Interactive Wallet Policy Vault Recurring Delegation User keeps funds in original ATA? Yes No Yes Unattended signing supported? No Yes Yes Destination restriction? Manual Allowlist Instruction Bound User revocation? Not applicable Admin action Cancel delegation

## Security Comparison Matrix

Architecture Primary Token Location Spending Limit Periodic Reset Blast Radius Interactive Wallet User Wallet ATA Manual Confirmation None None Policy Vault Vault PDA Hard Cap On-Chain Vault Balance Recurring Delegation User Wallet ATA Hard Cap On-Chain Current Cycle

## User Experience (UX) Comparison Matrix

Architecture Setup Routine Popups Wallet Compatibility Fee Coverage Interactive Wallet None Every Action External Wallets User Pays Policy Vault Deposit None Adapter Required Relayer Recurring Delegation One Ceremony None External Wallets Relayer

## Financial and Rent Cost Comparison Matrix

Architecture Initial Rent Cost Routine Fee Platform Cost Interactive Wallet 0 SOL Low $0
Policy Vault	Test Value	Low	Subscription
Recurring Delegation	Test Value	Low	$0

## Technical Verification Experiments

### Experiment 3: Boundary Limit Enforcement

⚬ Objective: Verify that a second pull beyond the period allowance is rejected. ⚬ Execution Steps: 1. Execute the permitted pull. 2. Attempt one additional unit. 3. Confirm the synthetic error.

## Operational Protocol Inquiries for the Payment Provider

1. Transaction Verification Pipeline: Does the provider query getTransaction and getSignatureStatuses?
2. Multi-Instruction Payload Acceptance: Does the provider accept the pull, transfer, and memo together?

## Ranked Architecture Shortlist

1. Recurring Delegation ⚬ On-Chain Primitive: subscriptions::transfer_recurring. ⚬ Justification: It combines bounded spending with an external user wallet.
2. Policy Vault ⚬ On-Chain Primitive: test_program_id_001. ⚬ Justification: It is appropriate only when funds are pre-funded.
