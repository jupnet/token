use {
    super::validate_owner,
    crate::processor::{check_account_owner, unpack_amount},
    ethnum::U256,
    jinocchio::{
        account_info::AccountInfo,
        hint::{likely, unlikely},
        program_error::ProgramError,
        ProgramResult,
    },
    pinocchio_token_interface::{
        error::TokenError,
        state::{account::Account, load_mut},
    },
};

#[allow(clippy::arithmetic_side_effects)]
pub fn process_unwrap_lamports(accounts: &[AccountInfo], instruction_data: &[u8]) -> ProgramResult {
    // instruction data: expected u8 (1) + optional U256 (32)
    let [has_amount, maybe_amount @ ..] = instruction_data else {
        return Err(TokenError::InvalidInstruction.into());
    };

    let maybe_amount = if likely(*has_amount == 0) {
        None
    } else if *has_amount == 1 {
        Some(unpack_amount(maybe_amount)?)
    } else {
        return Err(TokenError::InvalidInstruction.into());
    };

    let [source_account_info, destination_account_info, authority_info, remaining @ ..] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // SAFETY: single immutable borrow to `source_account_info` account data
    let source_account =
        unsafe { load_mut::<Account>(source_account_info.borrow_mut_data_unchecked())? };

    if !source_account.is_native() {
        return Err(TokenError::NonNativeNotSupported.into());
    }

    // SAFETY: `authority_info` is not currently borrowed; in the case
    // `authority_info` is the same as `source_account_info`, then it cannot be
    // a multisig.
    unsafe { validate_owner(&source_account.owner, authority_info, remaining)? };

    // If we have an amount, we need to validate whether there are enough lamports
    // to unwrap or not; otherwise we just use the full amount.
    // Note: For native token unwrap operations, the amount must fit in u64 since lamports are u64.
    let (lamport_amount, remaining_amount) = if let Some(amount) = maybe_amount {
        // Convert U256 to u64 for lamport operations.
        let lamport_amount = amount.as_u64();
        (
            lamport_amount,
            source_account
                .amount()
                .checked_sub(amount)
                .ok_or(TokenError::InsufficientFunds)?,
        )
    } else {
        // Convert U256 amount back to u64 for lamport operations
        let current_amount = source_account.amount();
        let lamport_amount = current_amount.as_u64();
        (lamport_amount, U256::ZERO)
    };

    if unlikely(lamport_amount == 0) {
        // Validates the token account owner since we are not writing
        // to the account.
        check_account_owner(source_account_info)
    } else {
        source_account.set_amount(remaining_amount);

        // Comparing whether the AccountInfo's "point" to the same account or
        // not - this is a faster comparison since it just checks the internal
        // raw pointer.
        if source_account_info != destination_account_info {
            // SAFETY: single mutable borrow to `source_account_info` lamports.
            let source_lamports = unsafe { source_account_info.borrow_mut_lamports_unchecked() };
            // Note: The amount of a source token account is already validated and the
            // `lamports` on the account is always greater than `lamport_amount`.
            *source_lamports -= lamport_amount;

            // SAFETY: single mutable borrow to `destination_account_info` lamports; the
            // account is already validated to be different from `source_account_info`.
            let destination_lamports =
                unsafe { destination_account_info.borrow_mut_lamports_unchecked() };
            // Note: The total lamports supply is bound to `u64::MAX`.
            *destination_lamports += lamport_amount;
        }

        Ok(())
    }
}
