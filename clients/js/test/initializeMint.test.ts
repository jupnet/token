import { getCreateAccountInstruction } from '@solana-program/system';
import {
  appendTransactionMessageInstructions,
  generateKeyPairSigner,
  none,
  pipe,
  some,
} from '@solana/kit';
import test from 'ava';
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMint,
  getInitializeMintInstruction,
  getMintSize,
} from '../src';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
  leBytesToU256,
} from './_setup';

test('it creates and initializes a new mint account', async (t) => {
  // Given an authority and a mint account.
  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const mint = await generateKeyPairSigner();

  // When we create and initialize a mint account at this address.
  const space = BigInt(getMintSize());
  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();
  const instructions = [
    getCreateAccountInstruction({
      payer: authority,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: 2,
      mintAuthority: authority.address,
    }),
  ];
  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

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
  const space = BigInt(getMintSize());
  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();
  const instructions = [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: 0,
      mintAuthority: mintAuthority.address,
      freezeAuthority: freezeAuthority.address,
    }),
  ];
  await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then we expect the mint account to exist and have the following data.
  const mintAccount = await fetchMint(client.rpc, mint.address);
  t.is(mintAccount.address, mint.address);
  t.deepEqual(mintAccount.data.mintAuthority, some(mintAuthority.address));
  t.deepEqual(mintAccount.data.freezeAuthority, some(freezeAuthority.address));
});
