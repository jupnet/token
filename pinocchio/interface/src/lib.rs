#![no_std]

pub mod error;
pub mod instruction;
pub mod native_mint;
pub mod state;

pub mod program {
    jinocchio_pubkey::declare_id!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
}
