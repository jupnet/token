mod setup;

use {
    ethnum::U256,
    mollusk_svm::result::Check,
    setup::{
        mint,
        mollusk::{create_mint_account, mollusk},
        TOKEN_PROGRAM_ID,
    },
    solana_program_test::{tokio, ProgramTest},
    solana_pubkey::Pubkey,
    solana_signer::Signer,
    solana_transaction::Transaction,
};

#[tokio::test]
async fn amount_to_ui_amount() {
    let mut context = ProgramTest::new("pinocchio_token_program", TOKEN_PROGRAM_ID, None)
        .start_with_context()
        .await;

    // Given a mint account.

    let mint_authority = Pubkey::new_unique();
    let freeze_authority = Pubkey::new_unique();

    let mint = mint::initialize(
        &mut context,
        mint_authority,
        Some(freeze_authority),
        &TOKEN_PROGRAM_ID,
    )
    .await
    .unwrap();

    let amount_to_ui_amount_ix = spl_token_interface::instruction::amount_to_ui_amount(
        &spl_token_interface::ID,
        &mint,
        U256::new(1000),
    )
    .unwrap();

    let tx = Transaction::new_signed_with_payer(
        &[amount_to_ui_amount_ix],
        Some(&context.payer.pubkey()),
        &[&context.payer],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    // Then the transaction should succeed.

    let account = context.banks_client.get_account(mint).await.unwrap();

    assert!(account.is_some());
}

#[test]
fn amount_to_ui_amount_with_maximum_decimals() {
    // Given a mint account with `u8::MAX` as decimals.

    let mint = Pubkey::new_unique();
    let mint_authority = Pubkey::new_unique();
    let freeze_authority = Pubkey::new_unique();

    let mint_account = create_mint_account(
        mint_authority,
        Some(freeze_authority),
        u8::MAX,
        &TOKEN_PROGRAM_ID,
    );

    // When we convert a 20 amount using the mint, the transaction should
    //  succeed and return the correct UI amount.

    let instruction = spl_token_interface::instruction::amount_to_ui_amount(
        &spl_token_interface::ID,
        &mint,
        U256::new(20),
    )
    .unwrap();

    // The expected UI amount is "0.000....002" without the trailing zeros.
    let mut ui_amount = [b'0'; u8::MAX as usize + 1];
    ui_amount[1] = b'.';
    ui_amount[ui_amount.len() - 1] = b'2';

    mollusk().process_and_validate_instruction(
        &instruction,
        &[(mint, mint_account)],
        &[Check::success(), Check::return_data(&ui_amount)],
    );
}

#[test]
fn amount_to_ui_amount_with_u64_max() {
    // Given a mint account with `u8::MAX` as decimals.

    let mint = Pubkey::new_unique();
    let mint_authority = Pubkey::new_unique();
    let freeze_authority = Pubkey::new_unique();

    let mint_account = create_mint_account(
        mint_authority,
        Some(freeze_authority),
        u8::MAX,
        &TOKEN_PROGRAM_ID,
    );

    // When we convert an u64::MAX amount using the mint, the transaction should
    // succeed and return the correct UI amount.

    let instruction = spl_token_interface::instruction::amount_to_ui_amount(
        &spl_token_interface::ID,
        &mint,
        U256::from(u64::MAX),
    )
    .unwrap();

    // The expected UI amount is a `u64::MAX` with 255 decimal places.
    //   - 2 digits for `0.`
    //   - 255 digits for the maximum decimals.
    let mut ui_amount = [b'0'; u8::MAX as usize + 2];
    ui_amount[1] = b'.';

    let mut offset = ui_amount.len();
    let mut value = u64::MAX;

    while value > 0 {
        let remainder = value % 10;
        value /= 10;
        offset -= 1;

        ui_amount[offset] = b'0' + (remainder as u8);
    }

    mollusk().process_and_validate_instruction(
        &instruction,
        &[(mint, mint_account)],
        &[Check::success(), Check::return_data(&ui_amount)],
    );
}

#[test]
fn amount_to_ui_amount_with_large_u256() {
    // Given a mint account with 6 decimals.

    let mint = Pubkey::new_unique();
    let mint_authority = Pubkey::new_unique();
    let freeze_authority = Pubkey::new_unique();

    let mint_account = create_mint_account(
        mint_authority,
        Some(freeze_authority),
        6,
        &TOKEN_PROGRAM_ID,
    );

    // Test u64::MAX first (should work)
    let u64_max_amount = U256::from(u64::MAX);
    let instruction1 = spl_token_interface::instruction::amount_to_ui_amount(
        &spl_token_interface::ID,
        &mint,
        u64_max_amount,
    )
    .unwrap();

    eprintln!("\n=== u64::MAX test ===");
    eprintln!("amount = {}", u64_max_amount);
    eprintln!("instruction data = {:?}", instruction1.data);

    let result1 = mollusk().process_instruction(
        &instruction1,
        &[(mint, mint_account.clone())],
    );

    eprintln!("return_data = {:?}", std::str::from_utf8(&result1.return_data));

    // Now test u64::MAX + 1
    let large_amount = U256::from(u64::MAX) + U256::new(1);
    let instruction2 = spl_token_interface::instruction::amount_to_ui_amount(
        &spl_token_interface::ID,
        &mint,
        large_amount,
    )
    .unwrap();

    eprintln!("\n=== u64::MAX + 1 test ===");
    eprintln!("amount = {}", large_amount);
    eprintln!("instruction data = {:?}", instruction2.data);

    let result2 = mollusk().process_instruction(
        &instruction2,
        &[(mint, mint_account)],
    );

    eprintln!("return_data = {:?}", std::str::from_utf8(&result2.return_data));

    // The expected UI amount is "18446744073709.551616"
    let ui_amount = b"18446744073709.551616";

    assert_eq!(result2.return_data.as_slice(), ui_amount.as_slice());
}
