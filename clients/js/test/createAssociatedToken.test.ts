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
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
} from '../src';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createMint,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
  leBytesToU256,
} from './_setup';

test('it creates a new associated token account', async (t) => {
  // Given a mint account, its mint authority and a token owner.
  const client = createDefaultSolanaClient();
  const [payer, mintAuthority, owner] = await Promise.all([
    generateKeyPairSignerWithSol(client),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const mint = await createMint(client, payer, mintAuthority.address);

  // When we create and initialize a token account at this address.
  const createAta = await getCreateAssociatedTokenInstructionAsync({
    payer,
    mint,
    owner: owner.address,
  });

  await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionMessageInstruction(createAta, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

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
  t.is(leBytesToU256(tokenAccount.data.amount), 0n);
  t.deepEqual(tokenAccount.data.delegate, none());
  t.is(tokenAccount.data.state, AccountState.Initialized);
  t.deepEqual(tokenAccount.data.isNative, none());
  t.is(leBytesToU256(tokenAccount.data.delegatedAmount), 0n);
  t.deepEqual(tokenAccount.data.closeAuthority, none());
});
