import {
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  pipe,
} from '@solana/kit';
import test from 'ava';
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
  getTransferToATAInstructionPlan,
  getTransferToATAInstructionPlanAsync,
} from '../src';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createDefaultTransactionPlanner,
  createMint,
  createTokenPdaWithAmount,
  createTokenWithAmount,
  generateKeyPairSignerWithSol,
  leBytesToU256,
  signAndSendTransaction,
  u256ToLeBytes,
} from './_setup';

test('it transfers tokens from one account to a new ATA', async (t) => {
  // Given a mint account, one token account with 100 tokens, and a second owner.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, ownerA, ownerB] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const decimals = 2;
  const mint = await createMint(client, payer, mintAuthority.address, decimals);
  const tokenA = await createTokenWithAmount(
    client,
    payer,
    mintAuthority,
    mint,
    ownerA.address,
    100n
  );

  const [tokenB] = await findAssociatedTokenPda({
    owner: ownerB.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  // When owner A transfers 50 tokens to owner B.
  const instructionPlan = getTransferToATAInstructionPlan({
    payer,
    mint,
    source: tokenA,
    authority: ownerA,
    destination: tokenB,
    recipient: ownerB.address,
    amount: 50n,
    decimals,
  });

  const transactionPlanner = createDefaultTransactionPlanner(client, payer);
  const transactionPlan = await transactionPlanner(instructionPlan);
  await client.sendTransactionPlan(transactionPlan);

  // Then we expect the mint and token accounts to have the following updated data.
  const [{ data: mintData }, { data: tokenDataA }, { data: tokenDataB }] =
    await Promise.all([
      fetchMint(client.rpc, mint),
      fetchToken(client.rpc, tokenA),
      fetchToken(client.rpc, tokenB),
    ]);
  t.is(leBytesToU256(mintData.supply), 100n);
  t.is(leBytesToU256(tokenDataA.amount), 50n);
  t.is(leBytesToU256(tokenDataB.amount), 50n);
});

test('derives a new ATA and transfers tokens to it', async (t) => {
  // Given a mint account, one token account with 100 tokens, and a second owner.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, ownerA, ownerB] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const decimals = 2;
  const mint = await createMint(client, payer, mintAuthority.address, decimals);
  const tokenA = await createTokenWithAmount(
    client,
    payer,
    mintAuthority,
    mint,
    ownerA.address,
    100n
  );

  // When owner A transfers 50 tokens to owner B.
  const instructionPlan = await getTransferToATAInstructionPlanAsync({
    payer,
    mint,
    source: tokenA,
    authority: ownerA,
    recipient: ownerB.address,
    amount: 50n,
    decimals,
  });

  const transactionPlanner = createDefaultTransactionPlanner(client, payer);
  const transactionPlan = await transactionPlanner(instructionPlan);
  await client.sendTransactionPlan(transactionPlan);

  // Then we expect the mint and token accounts to have the following updated data.
  const [tokenB] = await findAssociatedTokenPda({
    owner: ownerB.address,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const [{ data: mintData }, { data: tokenDataA }, { data: tokenDataB }] =
    await Promise.all([
      fetchMint(client.rpc, mint),
      fetchToken(client.rpc, tokenA),
      fetchToken(client.rpc, tokenB),
    ]);
  t.is(leBytesToU256(mintData.supply), 100n);
  t.is(leBytesToU256(tokenDataA.amount), 50n);
  t.is(leBytesToU256(tokenDataB.amount), 50n);
});

test('it transfers tokens from one account to an existing ATA', async (t) => {
  // Given a mint account and two token accounts.
  // One with 90 tokens and the other with 10 tokens.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, ownerA, ownerB] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const decimals = 2;
  const mint = await createMint(client, payer, mintAuthority.address, decimals);
  const [tokenA, tokenB] = await Promise.all([
    createTokenWithAmount(
      client,
      payer,
      mintAuthority,
      mint,
      ownerA.address,
      90n
    ),
    createTokenPdaWithAmount(
      client,
      payer,
      mintAuthority,
      mint,
      ownerB.address,
      10n,
      decimals
    ),
  ]);

  // When owner A transfers 50 tokens to owner B.
  // Note: We use getTransferCheckedInstruction directly instead of getTransferToATAInstructionPlan
  // because the standard ATA program validates account size (165 bytes) which doesn't match
  // our U256-extended token account size (213 bytes).
  const transferInstruction = getTransferCheckedInstruction({
    source: tokenA,
    mint,
    destination: tokenB,
    authority: ownerA,
    amount: u256ToLeBytes(50n),
    decimals,
  });

  await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionMessageInstruction(transferInstruction, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then we expect the mint and token accounts to have the following updated data.
  const [{ data: mintData }, { data: tokenDataA }, { data: tokenDataB }] =
    await Promise.all([
      fetchMint(client.rpc, mint),
      fetchToken(client.rpc, tokenA),
      fetchToken(client.rpc, tokenB),
    ]);
  t.is(leBytesToU256(mintData.supply), 100n);
  t.is(leBytesToU256(tokenDataA.amount), 40n);
  t.is(leBytesToU256(tokenDataB.amount), 60n);
});
