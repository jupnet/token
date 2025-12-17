import { getCreateAccountInstruction } from '@solana-program/system';
import {
  appendTransactionMessageInstructions,
  generateKeyPairSigner,
  none,
  pipe,
} from '@solana/kit';
import test from 'ava';
import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  getInitializeAccountInstruction,
  getTokenSize,
} from '../src';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createMint,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
  leBytesToU256,
} from './_setup';

test('it creates and initializes a new token account', async (t) => {
  // Given a mint account, its mint authority and two generated keypairs
  // for the token to be created and its owner.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, token, owner] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const mint = await createMint(client, payer, mintAuthority.address);

  // When we create and initialize a token account at this address.
  const space = BigInt(getTokenSize());
  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();
  const instructions = [
    getCreateAccountInstruction({
      payer,
      newAccount: token,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeAccountInstruction({
      account: token.address,
      mint,
      owner: owner.address,
    }),
  ];
  await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then we expect the token account to exist and have the following data.
  const tokenAccount = await fetchToken(client.rpc, token.address);
  t.is(tokenAccount.address, token.address);
  t.is(tokenAccount.data.mint, mint);
  t.is(tokenAccount.data.owner, owner.address);
  t.is(leBytesToU256(tokenAccount.data.amount), 0n);
  t.deepEqual(tokenAccount.data.delegate, none());
  t.is(tokenAccount.data.state, AccountState.Initialized);
  t.deepEqual(tokenAccount.data.isNative, none());
  t.is(leBytesToU256(tokenAccount.data.delegatedAmount), 0n);
  t.deepEqual(tokenAccount.data.closeAuthority, none());
});
