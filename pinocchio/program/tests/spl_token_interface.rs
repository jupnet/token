#![allow(dead_code, unused_imports)]

use {
    ethnum::U256,
    solana_instruction::{AccountMeta, Instruction},
    solana_program_error::ProgramError,
    solana_program_option::COption,
    solana_pubkey::Pubkey,
};

pub use ::spl_token_interface::ID;

fn amount_data(discriminator: u8, amount: U256) -> Vec<u8> {
    let mut data = Vec::with_capacity(1 + 32);
    data.push(discriminator);
    data.extend_from_slice(&amount.to_le_bytes());
    data
}

fn amount_and_decimals_data(discriminator: u8, amount: U256, decimals: u8) -> Vec<u8> {
    let mut data = amount_data(discriminator, amount);
    data.push(decimals);
    data
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Amount(pub U256);

impl PartialEq<U256> for Amount {
    fn eq(&self, other: &U256) -> bool {
        self.0 == *other
    }
}

impl PartialEq<Amount> for U256 {
    fn eq(&self, other: &Amount) -> bool {
        *self == other.0
    }
}

impl PartialEq<u64> for Amount {
    fn eq(&self, other: &u64) -> bool {
        self.0 == U256::from(*other)
    }
}

impl PartialEq<Amount> for u64 {
    fn eq(&self, other: &Amount) -> bool {
        U256::from(*self) == other.0
    }
}

pub mod instruction {
    use super::*;

    pub use ::spl_token_interface::instruction::{
        initialize_account,
        initialize_account2,
        initialize_account3,
        initialize_immutable_owner,
        initialize_mint,
        initialize_mint2,
        initialize_multisig,
        initialize_multisig2,
        is_valid_signer_index,
        revoke,
        set_authority,
        sync_native,
        sync_native_with_rent_sysvar,
        thaw_account,
        ui_amount_to_amount,
        AuthorityType,
        close_account,
        freeze_account,
        get_account_data_size,
    };
    use pinocchio_token_interface::instruction::TokenInstruction;

    pub fn transfer(
        token_program_id: &Pubkey,
        source_pubkey: &Pubkey,
        destination_pubkey: &Pubkey,
        authority_pubkey: &Pubkey,
        signer_pubkeys: &[&Pubkey],
        amount: U256,
    ) -> Result<Instruction, ProgramError> {
        let mut accounts = Vec::with_capacity(3 + signer_pubkeys.len());
        accounts.push(AccountMeta::new(*source_pubkey, false));
        accounts.push(AccountMeta::new(*destination_pubkey, false));
        accounts.push(AccountMeta::new_readonly(
            *authority_pubkey,
            signer_pubkeys.is_empty(),
        ));
        for signer_pubkey in signer_pubkeys {
            accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
        }

        Ok(Instruction {
            program_id: *token_program_id,
            accounts,
            data: amount_data(TokenInstruction::Transfer as u8, amount),
        })
    }

    pub fn approve(
        token_program_id: &Pubkey,
        source_pubkey: &Pubkey,
        delegate_pubkey: &Pubkey,
        owner_pubkey: &Pubkey,
        signer_pubkeys: &[&Pubkey],
        amount: U256,
    ) -> Result<Instruction, ProgramError> {
        let mut accounts = Vec::with_capacity(3 + signer_pubkeys.len());
        accounts.push(AccountMeta::new(*source_pubkey, false));
        accounts.push(AccountMeta::new_readonly(*delegate_pubkey, false));
        accounts.push(AccountMeta::new_readonly(
            *owner_pubkey,
            signer_pubkeys.is_empty(),
        ));
        for signer_pubkey in signer_pubkeys {
            accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
        }

        Ok(Instruction {
            program_id: *token_program_id,
            accounts,
            data: amount_data(TokenInstruction::Approve as u8, amount),
        })
    }

    pub fn mint_to(
        token_program_id: &Pubkey,
        mint_pubkey: &Pubkey,
        account_pubkey: &Pubkey,
        owner_pubkey: &Pubkey,
        signer_pubkeys: &[&Pubkey],
        amount: U256,
    ) -> Result<Instruction, ProgramError> {
        let mut accounts = Vec::with_capacity(3 + signer_pubkeys.len());
        accounts.push(AccountMeta::new(*mint_pubkey, false));
        accounts.push(AccountMeta::new(*account_pubkey, false));
        accounts.push(AccountMeta::new_readonly(
            *owner_pubkey,
            signer_pubkeys.is_empty(),
        ));
        for signer_pubkey in signer_pubkeys {
            accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
        }

        Ok(Instruction {
            program_id: *token_program_id,
            accounts,
            data: amount_data(TokenInstruction::MintTo as u8, amount),
        })
    }

    pub fn burn(
        token_program_id: &Pubkey,
        account_pubkey: &Pubkey,
        mint_pubkey: &Pubkey,
        authority_pubkey: &Pubkey,
        signer_pubkeys: &[&Pubkey],
        amount: U256,
    ) -> Result<Instruction, ProgramError> {
        let mut accounts = Vec::with_capacity(3 + signer_pubkeys.len());
        accounts.push(AccountMeta::new(*account_pubkey, false));
        accounts.push(AccountMeta::new(*mint_pubkey, false));
        accounts.push(AccountMeta::new_readonly(
            *authority_pubkey,
            signer_pubkeys.is_empty(),
        ));
        for signer_pubkey in signer_pubkeys {
            accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
        }

        Ok(Instruction {
            program_id: *token_program_id,
            accounts,
            data: amount_data(TokenInstruction::Burn as u8, amount),
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub fn transfer_checked(
        token_program_id: &Pubkey,
        source_pubkey: &Pubkey,
        mint_pubkey: &Pubkey,
        destination_pubkey: &Pubkey,
        authority_pubkey: &Pubkey,
        signer_pubkeys: &[&Pubkey],
        amount: U256,
        decimals: u8,
    ) -> Result<Instruction, ProgramError> {
        let mut accounts = Vec::with_capacity(4 + signer_pubkeys.len());
        accounts.push(AccountMeta::new(*source_pubkey, false));
        accounts.push(AccountMeta::new_readonly(*mint_pubkey, false));
        accounts.push(AccountMeta::new(*destination_pubkey, false));
        accounts.push(AccountMeta::new_readonly(
            *authority_pubkey,
            signer_pubkeys.is_empty(),
        ));
        for signer_pubkey in signer_pubkeys {
            accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
        }

        Ok(Instruction {
            program_id: *token_program_id,
            accounts,
            data: amount_and_decimals_data(TokenInstruction::TransferChecked as u8, amount, decimals),
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub fn approve_checked(
        token_program_id: &Pubkey,
        source_pubkey: &Pubkey,
        mint_pubkey: &Pubkey,
        delegate_pubkey: &Pubkey,
        owner_pubkey: &Pubkey,
        signer_pubkeys: &[&Pubkey],
        amount: U256,
        decimals: u8,
    ) -> Result<Instruction, ProgramError> {
        let mut accounts = Vec::with_capacity(4 + signer_pubkeys.len());
        accounts.push(AccountMeta::new(*source_pubkey, false));
        accounts.push(AccountMeta::new_readonly(*mint_pubkey, false));
        accounts.push(AccountMeta::new_readonly(*delegate_pubkey, false));
        accounts.push(AccountMeta::new_readonly(
            *owner_pubkey,
            signer_pubkeys.is_empty(),
        ));
        for signer_pubkey in signer_pubkeys {
            accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
        }

        Ok(Instruction {
            program_id: *token_program_id,
            accounts,
            data: amount_and_decimals_data(TokenInstruction::ApproveChecked as u8, amount, decimals),
        })
    }

    pub fn mint_to_checked(
        token_program_id: &Pubkey,
        mint_pubkey: &Pubkey,
        account_pubkey: &Pubkey,
        owner_pubkey: &Pubkey,
        signer_pubkeys: &[&Pubkey],
        amount: U256,
        decimals: u8,
    ) -> Result<Instruction, ProgramError> {
        let mut accounts = Vec::with_capacity(3 + signer_pubkeys.len());
        accounts.push(AccountMeta::new(*mint_pubkey, false));
        accounts.push(AccountMeta::new(*account_pubkey, false));
        accounts.push(AccountMeta::new_readonly(
            *owner_pubkey,
            signer_pubkeys.is_empty(),
        ));
        for signer_pubkey in signer_pubkeys {
            accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
        }

        Ok(Instruction {
            program_id: *token_program_id,
            accounts,
            data: amount_and_decimals_data(TokenInstruction::MintToChecked as u8, amount, decimals),
        })
    }

    pub fn burn_checked(
        token_program_id: &Pubkey,
        account_pubkey: &Pubkey,
        mint_pubkey: &Pubkey,
        authority_pubkey: &Pubkey,
        signer_pubkeys: &[&Pubkey],
        amount: U256,
        decimals: u8,
    ) -> Result<Instruction, ProgramError> {
        let mut accounts = Vec::with_capacity(3 + signer_pubkeys.len());
        accounts.push(AccountMeta::new(*account_pubkey, false));
        accounts.push(AccountMeta::new(*mint_pubkey, false));
        accounts.push(AccountMeta::new_readonly(
            *authority_pubkey,
            signer_pubkeys.is_empty(),
        ));
        for signer_pubkey in signer_pubkeys {
            accounts.push(AccountMeta::new_readonly(**signer_pubkey, true));
        }

        Ok(Instruction {
            program_id: *token_program_id,
            accounts,
            data: amount_and_decimals_data(TokenInstruction::BurnChecked as u8, amount, decimals),
        })
    }

    pub fn amount_to_ui_amount(
        token_program_id: &Pubkey,
        mint_pubkey: &Pubkey,
        amount: U256,
    ) -> Result<Instruction, ProgramError> {
        Ok(Instruction {
            program_id: *token_program_id,
            accounts: vec![AccountMeta::new_readonly(*mint_pubkey, false)],
            data: amount_data(TokenInstruction::AmountToUiAmount as u8, amount),
        })
    }
}

pub mod state {
    use super::*;
    use pinocchio_token_interface::state::{
        account::Account as RawAccount,
        account_state::AccountState as RawAccountState,
        mint::Mint as RawMint,
        multisig::{Multisig as RawMultisig, MAX_SIGNERS},
        load,
        load_unchecked,
        Initializable,
        Transmutable,
    };

    #[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
    pub enum AccountState {
        #[default]
        Uninitialized,
        Initialized,
        Frozen,
    }

    impl From<RawAccountState> for AccountState {
        fn from(value: RawAccountState) -> Self {
            match value {
                RawAccountState::Uninitialized => Self::Uninitialized,
                RawAccountState::Initialized => Self::Initialized,
                RawAccountState::Frozen => Self::Frozen,
            }
        }
    }

    #[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
    pub struct Mint {
        pub mint_authority: COption<Pubkey>,
        pub supply: Amount,
        pub decimals: u8,
        pub is_initialized: bool,
        pub freeze_authority: COption<Pubkey>,
    }

    impl Mint {
        pub const LEN: usize = RawMint::LEN;

        pub fn unpack(src: &[u8]) -> Result<Self, ProgramError> {
            let mint = unsafe { load::<RawMint>(src) }.map_err(|_| ProgramError::InvalidAccountData)?;
            Self::from_raw(mint)
        }

        fn from_raw(mint: &RawMint) -> Result<Self, ProgramError> {
            Ok(Self {
                mint_authority: mint
                    .mint_authority()
                    .map(|value| Pubkey::new_from_array(*value))
                    .into(),
                supply: Amount(mint.supply()),
                decimals: mint.decimals,
                is_initialized: mint
                    .is_initialized()
                    .map_err(|_| ProgramError::InvalidAccountData)?,
                freeze_authority: mint
                    .freeze_authority()
                    .map(|value| Pubkey::new_from_array(*value))
                    .into(),
            })
        }
    }

    #[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
    pub struct Account {
        pub mint: Pubkey,
        pub owner: Pubkey,
        pub amount: Amount,
        pub delegate: COption<Pubkey>,
        pub state: AccountState,
        pub is_native: COption<u64>,
        pub delegated_amount: Amount,
        pub close_authority: COption<Pubkey>,
    }

    impl Account {
        pub const LEN: usize = RawAccount::LEN;

        pub fn unpack(src: &[u8]) -> Result<Self, ProgramError> {
            let account =
                unsafe { load::<RawAccount>(src) }.map_err(|_| ProgramError::InvalidAccountData)?;
            Self::from_raw(account)
        }

        pub fn unpack_unchecked(src: &[u8]) -> Result<Self, ProgramError> {
            let account = unsafe { load_unchecked::<RawAccount>(src) }
                .map_err(|_| ProgramError::InvalidAccountData)?;
            Self::from_raw(account)
        }

        fn from_raw(account: &RawAccount) -> Result<Self, ProgramError> {
            Ok(Self {
                mint: Pubkey::new_from_array(account.mint),
                owner: Pubkey::new_from_array(account.owner),
                amount: Amount(account.amount()),
                delegate: account
                    .delegate()
                    .map(|value| Pubkey::new_from_array(*value))
                    .into(),
                state: account
                    .account_state()
                    .map(AccountState::from)
                    .map_err(|_| ProgramError::InvalidAccountData)?,
                is_native: account.native_amount().into(),
                delegated_amount: Amount(account.delegated_amount()),
                close_authority: account
                    .close_authority()
                    .map(|value| Pubkey::new_from_array(*value))
                    .into(),
            })
        }

        pub fn is_frozen(&self) -> bool {
            self.state == AccountState::Frozen
        }

        pub fn is_native(&self) -> bool {
            self.is_native.is_some()
        }
    }

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub struct Multisig {
        pub m: u8,
        pub n: u8,
        pub is_initialized: bool,
        pub signers: [Pubkey; MAX_SIGNERS as usize],
    }

    impl Default for Multisig {
        fn default() -> Self {
            Self {
                m: 0,
                n: 0,
                is_initialized: false,
                signers: [Pubkey::default(); MAX_SIGNERS as usize],
            }
        }
    }

    impl Multisig {
        pub const LEN: usize = RawMultisig::LEN;

        pub fn unpack(src: &[u8]) -> Result<Self, ProgramError> {
            let multisig = unsafe { load::<RawMultisig>(src) }
                .map_err(|_| ProgramError::InvalidAccountData)?;
            let mut signers = [Pubkey::default(); MAX_SIGNERS as usize];
            for (dst, src) in signers.iter_mut().zip(multisig.signers.iter()) {
                *dst = Pubkey::new_from_array(*src);
            }
            Ok(Self {
                m: multisig.m,
                n: multisig.n,
                is_initialized: multisig
                    .is_initialized()
                    .map_err(|_| ProgramError::InvalidAccountData)?,
                signers,
            })
        }
    }
}
