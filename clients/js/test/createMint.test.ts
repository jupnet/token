import { generateKeyPairSigner, some, none } from '@solana/kit';
import test from 'ava';
import { fetchMint, getCreateMintInstructionPlan } from '../src';
import {
  createDefaultSolanaClient,
  generateKeyPairSignerWithSol,
  createDefaultTransactionPlanner,
  leBytesToU256,
} from './_setup';

test('it creates and initializes a new mint account', async (t) => {
  // Given an authority and a mint account.
  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const mint = await generateKeyPairSigner();

  // When we create and initialize a mint account at this address.
  const instructionPlan = getCreateMintInstructionPlan({
    payer: authority,
    newMint: mint,
    decimals: 2,
    mintAuthority: authority.address,
  });

  const transactionPlanner = createDefaultTransactionPlanner(client, authority);
  const transactionPlan = await transactionPlanner(instructionPlan);
  await client.sendTransactionPlan(transactionPlan);

  // Then we expect the mint account to exist and have the following data.
  const mintAccount = await fetchMint(client.rpc, mint.address);
  t.is(mintAccount.address, mint.address);
  t.deepEqual(mintAccount.data.mintAuthority, some(authority.address));
  t.is(leBytesToU256(mintAccount.data.supply), 0n);
  t.is(mintAccount.data.decimals, 2);
  t.is(mintAccount.data.isInitialized, true);
  t.deepEqual(mintAccount.data.freezeAuthority, none());
});

test('it creates a new mint account with a freeze authority', async (t) => {
  // Given an authority and a mint account.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, freezeAuthority, mint] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);

  // When we create and initialize a mint account at this address.
  const instructionPlan = getCreateMintInstructionPlan({
    payer: payer,
    newMint: mint,
    decimals: 2,
    mintAuthority: mintAuthority.address,
    freezeAuthority: freezeAuthority.address,
  });

  const transactionPlanner = createDefaultTransactionPlanner(client, payer);
  const transactionPlan = await transactionPlanner(instructionPlan);
  await client.sendTransactionPlan(transactionPlan);

  // Then we expect the mint account to exist and have the following data.
  const mintAccount = await fetchMint(client.rpc, mint.address);
  t.is(mintAccount.address, mint.address);
  t.deepEqual(mintAccount.data.mintAuthority, some(mintAuthority.address));
  t.deepEqual(mintAccount.data.freezeAuthority, some(freezeAuthority.address));
});
