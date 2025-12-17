import {
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  none,
  pipe,
} from '@solana/kit';
import test from 'ava';
import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  getMintToATAInstructionPlan,
  getMintToATAInstructionPlanAsync,
  getMintToCheckedInstruction,
  fetchToken,
  findAssociatedTokenPda,
} from '../src';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createDefaultTransactionPlanner,
  createMint,
  generateKeyPairSignerWithSol,
  leBytesToU256,
  signAndSendTransaction,
  u256ToLeBytes,
} from './_setup';

test('it creates a new associated token account with an initial balance', async (t) => {
  // Given a mint account, its mint authority, a token owner and the ATA.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, owner] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const decimals = 2;
  const mint = await createMint(client, payer, mintAuthority.address, decimals);
  const [ata] = await findAssociatedTokenPda({
    mint,
    owner: owner.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  // When we mint to a token account at this address.
  const instructionPlan = getMintToATAInstructionPlan({
    payer,
    ata,
    mint,
    owner: owner.address,
    mintAuthority,
    amount: 1_000n,
    decimals,
  });

  const transactionPlanner = createDefaultTransactionPlanner(client, payer);
  const transactionPlan = await transactionPlanner(instructionPlan);
  await client.sendTransactionPlan(transactionPlan);

  // Then we expect the token account to exist and have the following data.
  const tokenAccount = await fetchToken(client.rpc, ata);
  t.is(tokenAccount.address, ata);
  t.is(tokenAccount.data.mint, mint);
  t.is(tokenAccount.data.owner, owner.address);
  t.is(leBytesToU256(tokenAccount.data.amount), 1000n);
  t.deepEqual(tokenAccount.data.delegate, none());
  t.is(tokenAccount.data.state, AccountState.Initialized);
  t.deepEqual(tokenAccount.data.isNative, none());
  t.is(leBytesToU256(tokenAccount.data.delegatedAmount), 0n);
  t.deepEqual(tokenAccount.data.closeAuthority, none());
});

test('it derives a new associated token account with an initial balance', async (t) => {
  // Given a mint account, its mint authority, a token owner and the ATA.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, owner] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const decimals = 2;
  const mint = await createMint(client, payer, mintAuthority.address, decimals);

  // When we mint to a token account for the mint.
  const instructionPlan = await getMintToATAInstructionPlanAsync({
    payer,
    mint,
    owner: owner.address,
    mintAuthority,
    amount: 1_000n,
    decimals,
  });

  const transactionPlanner = createDefaultTransactionPlanner(client, payer);
  const transactionPlan = await transactionPlanner(instructionPlan);
  await client.sendTransactionPlan(transactionPlan);

  // Then we expect the token account to exist and have the following data.
  const [ata] = await findAssociatedTokenPda({
    mint,
    owner: owner.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const tokenAccount = await fetchToken(client.rpc, ata);
  t.is(tokenAccount.address, ata);
  t.is(tokenAccount.data.mint, mint);
  t.is(tokenAccount.data.owner, owner.address);
  t.is(leBytesToU256(tokenAccount.data.amount), 1000n);
  t.deepEqual(tokenAccount.data.delegate, none());
  t.is(tokenAccount.data.state, AccountState.Initialized);
  t.deepEqual(tokenAccount.data.isNative, none());
  t.is(leBytesToU256(tokenAccount.data.delegatedAmount), 0n);
  t.deepEqual(tokenAccount.data.closeAuthority, none());
});

test('it also mints to an existing associated token account', async (t) => {
  // Given a mint account, its mint authority, a token owner and the ATA.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, owner] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const decimals = 2;
  const mint = await createMint(client, payer, mintAuthority.address, decimals);
  const [ata] = await findAssociatedTokenPda({
    mint,
    owner: owner.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  // When we create and initialize a token account at this address.
  const instructionPlan = getMintToATAInstructionPlan({
    payer,
    ata,
    mint,
    owner: owner.address,
    mintAuthority,
    amount: 1_000n,
    decimals,
  });

  const transactionPlanner = createDefaultTransactionPlanner(client, payer);
  const transactionPlan = await transactionPlanner(instructionPlan);
  await client.sendTransactionPlan(transactionPlan);

  // And then we mint additional tokens to the same account.
  // Note: We use getMintToCheckedInstruction directly instead of getMintToATAInstructionPlan
  // because the standard ATA program validates account size (165 bytes) which doesn't match
  // our U256-extended token account size (213 bytes).
  const mintToInstruction = getMintToCheckedInstruction({
    mint,
    token: ata,
    mintAuthority,
    amount: u256ToLeBytes(1_000n),
    decimals,
  });

  await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionMessageInstruction(mintToInstruction, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then we expect the token account to exist and have the following data.
  const tokenAccount = await fetchToken(client.rpc, ata);
  t.is(tokenAccount.address, ata);
  t.is(tokenAccount.data.mint, mint);
  t.is(tokenAccount.data.owner, owner.address);
  t.is(leBytesToU256(tokenAccount.data.amount), 2000n);
  t.deepEqual(tokenAccount.data.delegate, none());
  t.is(tokenAccount.data.state, AccountState.Initialized);
  t.deepEqual(tokenAccount.data.isNative, none());
  t.is(leBytesToU256(tokenAccount.data.delegatedAmount), 0n);
  t.deepEqual(tokenAccount.data.closeAuthority, none());
});
