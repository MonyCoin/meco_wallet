// solanaService.js - التكامل الكامل مع العقد الجديد monycoin-meco
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Message, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

// ✅ تصحيح المسار: استيراد من نفس المستوى
import { PROGRAM_ID, RPC_URL, MECO_MINT } from '../constants';

// ✅ تصحيح المسار: contracts في المجلد الرئيسي
import IDL from '../contracts/monycoin_meco.json';

// إنشاء اتصال Solana مع معالجة الأخطاء
export const connection = new Connection(
  RPC_URL || 'https://api.devnet.solana.com',
  {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000
  }
);

export let PRESALE_WALLET_ADDRESS = '';

// =================== دوال إيجاد PDA ===================
export const findProtocolPDA = () => {
  try {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('protocol')],
      new PublicKey(PROGRAM_ID)
    );
  } catch (error) {
    console.warn('❌ فشل إيجاد Protocol PDA:', error);
    return [new PublicKey('11111111111111111111111111111111')];
  }
};

export const findPresaleVaultPDA = () => {
  try {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('presale_vault')],
      new PublicKey(PROGRAM_ID)
    );
  } catch (error) {
    console.warn('❌ فشل إيجاد Presale Vault PDA:', error);
    return [new PublicKey('11111111111111111111111111111111')];
  }
};

// =================== الدوال الرئيسية ===================
export const getPresaleStats = async (wallet) => {
  try {
    if (!wallet?.publicKey) {
      console.log('ℹ️ لا يوجد محفظة متصلة، استخدام بيانات افتراضية');
      return {
        totalTokens: 50000000,
        soldTokens: 12500000,
        minSOL: 0.05,
        maxSOL: 1,
        rate: 250000,
        progress: 25,
        currentBalance: 50,
        isActive: true
      };
    }

    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(IDL, new PublicKey(PROGRAM_ID), provider);
    const [protocolPDA] = findProtocolPDA();

    try {
      const protocolData = await program.account.protocol.fetch(protocolPDA);
      const [presaleVaultPDA] = findPresaleVaultPDA();
      const balance = await connection.getBalance(presaleVaultPDA);
      const currentBalance = balance / LAMPORTS_PER_SOL;

      PRESALE_WALLET_ADDRESS = presaleVaultPDA.toBase58();

      return {
        totalTokens: Number(protocolData.presaleTotal) / 1e9,
        soldTokens: Number(protocolData.presaleSold) / 1e9,
        minSOL: Number(protocolData.presaleMin) / LAMPORTS_PER_SOL,
        maxSOL: Number(protocolData.presaleMax) / LAMPORTS_PER_SOL,
        rate: Number(protocolData.presaleRate),
        progress: Math.min(100, (Number(protocolData.presaleSold) / Number(protocolData.presaleTotal)) * 100),
        currentBalance,
        isActive: protocolData.isActive,
        mecoMint: protocolData.mecoMint?.toBase58() || MECO_MINT
      };
    } catch (error) {
      console.warn('⚠️ استخدام بيانات افتراضية:', error.message);
      return {
        totalTokens: 50000000,
        soldTokens: 12500000,
        minSOL: 0.05,
        maxSOL: 1,
        rate: 250000,
        progress: 25,
        currentBalance: 50,
        isActive: true
      };
    }
  } catch (error) {
    console.error('❌ خطأ في getPresaleStats:', error);
    return {
      totalTokens: 50000000,
      soldTokens: 12500000,
      minSOL: 0.05,
      maxSOL: 1,
      rate: 250000,
      progress: 25,
      currentBalance: 50,
      isActive: true
    };
  }
};

export const buyMECOTransaction = async (wallet, amountSOL) => {
  try {
    if (!wallet?.publicKey) throw new Error('المحفظة غير متصلة');
    if (amountSOL <= 0) throw new Error('المبلغ يجب أن يكون أكبر من الصفر');

    const balance = await getSOLBalance(wallet.publicKey);
    if (balance < amountSOL) throw new Error('الرصيد غير كافي');

    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(IDL, new PublicKey(PROGRAM_ID), provider);
    const [protocolPDA] = findProtocolPDA();
    const [presaleVaultPDA] = findPresaleVaultPDA();

    const protocolData = await program.account.protocol.fetch(protocolPDA);
    // التحقق من الحدود
    const minSOL = Number(protocolData.presaleMin) / LAMPORTS_PER_SOL;
    const maxSOL = Number(protocolData.presaleMax) / LAMPORTS_PER_SOL;
    if (amountSOL < minSOL || amountSOL > maxSOL) {
      throw new Error(`المبلغ خارج الحدود (${minSOL} - ${maxSOL} SOL)`);
    }

    const mecoMint = new PublicKey(protocolData.mecoMint || MECO_MINT);
    const buyerTokenAccount = await getAssociatedTokenAddress(mecoMint, wallet.publicKey);
    const presaleTokenVault = await getAssociatedTokenAddress(mecoMint, protocolPDA, true);
    const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

    console.log('📝 إعداد معاملة الشراء...', {
      buyer: wallet.publicKey.toBase58(),
      amountSOL,
      amountLamports,
      rate: Number(protocolData.presaleRate)
    });

    const tx = await program.methods
      .buyTokens(new BN(amountLamports))
      .accounts({
        protocol: protocolPDA,
        buyer: wallet.publicKey,
        treasury: presaleVaultPDA,
        mecoVault: presaleTokenVault,
        buyerTokenAccount,
        authority: protocolData.authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();

    console.log('✅ تم إرسال المعاملة:', tx);
    await connection.confirmTransaction(tx, 'confirmed');

    const mecoAmount = Math.floor(amountSOL * Number(protocolData.presaleRate));

    return {
      success: true,
      signature: tx,
      mecoReceived: mecoAmount,
      message: 'تم الشراء بنجاح',
      amount: amountSOL,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ خطأ في الشراء:', error);
    return {
      success: false,
      error: error.message,
      message: `فشل الشراء: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
};

export const getSOLBalance = async (publicKey) => {
  if (!publicKey) {
    console.warn('⚠️ لا يوجد عنوان محفظة لطلب الرصيد');
    return 0;
  }

  try {
    const pubKey = new PublicKey(publicKey);
    const balance = await connection.getBalance(pubKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.warn('❌ خطأ في جلب الرصيد:', error.message);
    return 0;
  }
};

export const getMECOBalance = async (walletAddress, mecoMint = MECO_MINT) => {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { programId: TOKEN_PROGRAM_ID }
    );

    const mecoAccount = tokenAccounts.value.find(acc =>
      acc.account.data.parsed.info.mint === mecoMint
    );

    return mecoAccount ? mecoAccount.account.data.parsed.info.tokenAmount.uiAmount : 0;
  } catch (error) {
    console.error('❌ خطأ في جلب رصيد MECO:', error);
    return 0;
  }
};

export const isValidSolanaAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

export const getRealTransactionFee = async () => {
  try {
    // محاولة الحصول على رسوم حقيقية (طريقة حديثة)
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    // إنشاء رسالة بسيطة للحصول على الرسوم
    const message = new Message({
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
      },
      recentBlockhash: blockhash,
      instructions: [],
    });
    
    const fee = await connection.getFeeForMessage(message);
    return fee ? fee / LAMPORTS_PER_SOL : 0.000005;
  } catch (error) {
    console.warn('ℹ️ استخدام رسوم افتراضية:', error.message);
    return 0.000005; // رسوم افتراضية لـ Devnet
  }
};

export const getSolscanLink = (address) => {
  return `https://solscan.io/account/${address}?cluster=devnet`;
};

export const updatePresaleWalletAddress = (address) => {
  PRESALE_WALLET_ADDRESS = address;
};

// ✅ دالة مساعدة للتحقق من اتصال Solana
export const checkSolanaConnection = async () => {
  try {
    const version = await connection.getVersion();
    console.log('✅ اتصال Solana نشط:', version);
    return true;
  } catch (error) {
    console.error('❌ فشل اتصال Solana:', error);
    return false;
  }
};
