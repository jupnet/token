use {solana_program_test::ProgramTest, solana_pubkey::Pubkey};

#[allow(dead_code)]
pub mod account;
#[allow(dead_code)]
pub mod mint;
#[allow(dead_code)]
pub mod mollusk;

pub const TOKEN_PROGRAM_ID: Pubkey = Pubkey::new_from_array(pinocchio_token_interface::program::ID);

/// Creates a ProgramTest instance for testing the token program.
#[allow(dead_code)]
pub fn program_test() -> ProgramTest {
    // ProgramTest looks for the test program shared object via `BPF_OUT_DIR`.
    unsafe {
        std::env::set_var(
            "BPF_OUT_DIR",
            concat!(env!("CARGO_MANIFEST_DIR"), "/pinocchio/program"),
        );
    }
    ProgramTest::new("pinocchio_token_program", TOKEN_PROGRAM_ID, None)
}
