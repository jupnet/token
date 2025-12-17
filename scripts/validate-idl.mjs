#!/usr/bin/env zx
import 'zx/globals';
import { workingDirectory } from './utils.mjs';

// Expected account sizes from Rust interface (interface/src/state.rs)
// These are extracted by parsing the Rust source
const RUST_SOURCES = {
  mint: path.join(workingDirectory, 'interface', 'src', 'state.rs'),
  instruction: path.join(workingDirectory, 'interface', 'src', 'instruction.rs'),
};

const IDL_PATH = path.join(workingDirectory, 'program', 'idl.json');

// Parse Rust source to extract Pack::LEN constants
function extractLenConstants(rustSource) {
  const constants = {};

  // Match patterns like: const LEN: usize = 106;
  // or impl Pack for Mint { const LEN: usize = 106; }
  const implPackRegex = /impl\s+Pack\s+for\s+(\w+)\s*\{[^}]*const\s+LEN:\s*usize\s*=\s*(\d+)/gs;

  let match;
  while ((match = implPackRegex.exec(rustSource)) !== null) {
    const [, structName, len] = match;
    constants[structName.toLowerCase()] = parseInt(len, 10);
  }

  return constants;
}

// Extract instruction argument sizes from Rust
function extractInstructionAmountSizes(rustSource) {
  const instructions = {};

  // Look for U256 usage in instruction unpacking (32 bytes)
  // and u64 usage (8 bytes)
  // This is a heuristic - actual parsing would need more sophisticated analysis

  // Check if U256 is used for amounts
  const usesU256 = rustSource.includes('U256::from_le_bytes') || rustSource.includes('ethnum::U256');

  instructions.amountSize = usesU256 ? 32 : 8;

  return instructions;
}

// Extract sizes from IDL (Codama format)
function extractIdlSizes(idl) {
  const sizes = {
    accounts: {},
    instructions: {},
  };

  // Navigate to program node for Codama IDL format
  const program = idl.program || idl;
  const accounts = program.accounts || [];
  const instructions = program.instructions || [];

  // Extract account sizes
  for (const account of accounts) {
    if (account.size !== undefined) {
      sizes.accounts[account.name.toLowerCase()] = account.size;
    }
  }

  // Extract instruction amount argument sizes
  for (const instruction of instructions) {
    for (const arg of instruction.arguments || []) {
      if (arg.name === 'amount') {
        // Check if it's a 32-byte array (U256) or u64
        if (arg.type?.kind === 'arrayTypeNode' && arg.type?.count?.value === 32) {
          sizes.instructions[instruction.name] = { amountSize: 32 };
        } else if (arg.type?.kind === 'numberTypeNode' && arg.type?.format === 'u64') {
          sizes.instructions[instruction.name] = { amountSize: 8 };
        }
      }
    }
  }

  return sizes;
}

async function main() {
  let hasErrors = false;

  echo(chalk.blue('\n=== Validating IDL against Rust source ===\n'));

  // Read sources
  const stateRs = await fs.readFile(RUST_SOURCES.mint, 'utf-8');
  const instructionRs = await fs.readFile(RUST_SOURCES.instruction, 'utf-8');
  const idl = JSON.parse(await fs.readFile(IDL_PATH, 'utf-8'));

  // Extract Rust constants
  const rustLens = extractLenConstants(stateRs);
  const rustInstructions = extractInstructionAmountSizes(instructionRs);

  // Extract IDL sizes
  const idlSizes = extractIdlSizes(idl);

  echo(chalk.yellow('Rust Pack::LEN constants:'));
  for (const [name, len] of Object.entries(rustLens)) {
    echo(`  ${name}: ${len} bytes`);
  }

  echo(chalk.yellow('\nIDL account sizes:'));
  for (const [name, size] of Object.entries(idlSizes.accounts)) {
    echo(`  ${name}: ${size} bytes`);
  }

  echo(chalk.yellow('\nRust instruction amount type:'));
  echo(`  ${rustInstructions.amountSize === 32 ? 'U256 (32 bytes)' : 'u64 (8 bytes)'}`);

  // Validate account sizes
  echo(chalk.blue('\n--- Account Size Validation ---'));
  for (const [name, rustLen] of Object.entries(rustLens)) {
    const idlSize = idlSizes.accounts[name];
    if (idlSize === undefined) {
      echo(chalk.yellow(`  ${name}: Not found in IDL (Rust: ${rustLen})`));
    } else if (idlSize !== rustLen) {
      echo(chalk.red(`  ${name}: MISMATCH - Rust: ${rustLen}, IDL: ${idlSize}`));
      hasErrors = true;
    } else {
      echo(chalk.green(`  ${name}: OK (${rustLen} bytes)`));
    }
  }

  // Check for IDL accounts not in Rust
  for (const name of Object.keys(idlSizes.accounts)) {
    if (rustLens[name] === undefined) {
      echo(chalk.yellow(`  ${name}: In IDL but not found in Rust Pack impls`));
    }
  }

  // Validate instruction amount sizes
  echo(chalk.blue('\n--- Instruction Amount Size Validation ---'));
  const instructionsWithAmount = Object.entries(idlSizes.instructions);
  if (instructionsWithAmount.length === 0) {
    echo(chalk.yellow('  No instructions with amount arguments found in IDL'));
  } else {
    for (const [name, info] of instructionsWithAmount) {
      if (info.amountSize !== rustInstructions.amountSize) {
        echo(chalk.red(`  ${name}: MISMATCH - Rust: ${rustInstructions.amountSize}, IDL: ${info.amountSize}`));
        hasErrors = true;
      } else {
        echo(chalk.green(`  ${name}: OK (${info.amountSize} bytes)`));
      }
    }
  }

  // Summary
  echo('');
  if (hasErrors) {
    echo(chalk.red('=== VALIDATION FAILED ==='));
    echo(chalk.red('IDL does not match Rust source. Please update the IDL.'));
    process.exit(1);
  } else {
    echo(chalk.green('=== VALIDATION PASSED ==='));
    echo(chalk.green('IDL sizes match Rust source.'));
  }
}

main().catch((err) => {
  echo(chalk.red('Error:', err.message));
  process.exit(1);
});
