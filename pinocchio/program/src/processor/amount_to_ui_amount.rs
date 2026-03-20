use {
    super::{check_account_owner, unpack_amount, MAX_FORMATTED_DIGITS},
    core::str::from_utf8_unchecked,
    ethnum::U256,
    jinocchio::{
        account_info::AccountInfo, program::set_return_data, program_error::ProgramError,
        ProgramResult,
    },
    pinocchio_token_interface::{
        error::TokenError,
        state::{load, mint::Mint},
    },
};

/// Converts a U256 to a decimal string representation.
///
/// Returns the number of bytes written to the buffer.
/// The buffer must be at least 79 bytes (max digits for U256).
#[allow(clippy::arithmetic_side_effects)]
fn u256_to_string(mut n: U256, buffer: &mut [u8]) -> usize {
    // Check if n is zero using into_words to avoid potential SBF issues with == operator
    let (hi, lo) = n.into_words();
    if hi == 0 && lo == 0 {
        buffer[0] = b'0';
        return 1;
    }

    let mut pos = buffer.len();
    let ten = U256::from(10u64);

    // Extract digits from least significant to most significant
    loop {
        let (hi, lo) = n.into_words();
        if hi == 0 && lo == 0 {
            break;
        }
        pos -= 1;
        let remainder = n % ten;
        let digit = remainder.as_u64() as u8;
        buffer[pos] = b'0' + digit;
        n /= ten;
    }

    // Move the result to the beginning of the buffer
    let len = buffer.len() - pos;
    buffer.copy_within(pos.., 0);
    len
}

/// Formats a U256 amount with the given number of decimal places.
///
/// Returns the length of the formatted string in the buffer.
fn format_amount_with_decimals(amount: U256, decimals: u8, buffer: &mut [u8]) -> usize {
    // Convert U256 to string
    let num_str_len = u256_to_string(amount, buffer);

    if decimals == 0 {
        return num_str_len;
    }

    let decimals = decimals as usize;

    // Insert decimal point at the correct position
    if num_str_len <= decimals {
        // Need "0." prefix and leading zeros: e.g., 1 with 6 decimals -> "0.000001"
        let leading_zeros = decimals - num_str_len;
        let new_len = 2 + decimals; // "0." + decimals digits

        // Move digits to the end (after "0." and leading zeros)
        buffer.copy_within(0..num_str_len, 2 + leading_zeros);

        // Write "0." prefix
        buffer[0] = b'0';
        buffer[1] = b'.';

        // Fill leading zeros
        buffer[2..2 + leading_zeros].fill(b'0');

        new_len
    } else {
        // Insert decimal point in the middle: e.g., 1000000 with 6 decimals -> "1.000000"
        let decimal_pos = num_str_len - decimals;

        // Shift decimal portion right by 1 to make room for '.'
        buffer.copy_within(decimal_pos..num_str_len, decimal_pos + 1);
        buffer[decimal_pos] = b'.';

        num_str_len + 1
    }
}

pub fn process_amount_to_ui_amount(
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let amount = unpack_amount(instruction_data)?;

    let mint_info = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    check_account_owner(mint_info)?;
    // SAFETY: single immutable borrow to `mint_info` account data and
    // `load` validates that the mint is initialized.
    let mint = unsafe {
        load::<Mint>(mint_info.borrow_data_unchecked()).map_err(|_| TokenError::InvalidMint)?
    };

    let mut buffer = [0u8; MAX_FORMATTED_DIGITS];
    let len = format_amount_with_decimals(amount, mint.decimals, &mut buffer);

    // SAFETY: buffer contains valid UTF-8 (ASCII digits and '.')
    let mut s = unsafe { from_utf8_unchecked(&buffer[..len]) };

    // Trim trailing zeros and decimal point if needed
    if mint.decimals > 0 && s.contains('.') {
        s = s.trim_end_matches('0').trim_end_matches('.');
    }

    set_return_data(s.as_bytes());

    Ok(())
}
