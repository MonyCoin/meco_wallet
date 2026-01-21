import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';

// استخدام devnet للتجربة الفعلية
const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const JUPITER_API_BASE = 'https://api.jup.ag';

// دالة للحصول على قائمة العملات الحقيقية من Jupiter
export const getJupiterTokens = async () => {
  try {
    console.log('🔄 جلب العملات من Jupiter API...');
    const response = await fetch(`${JUPITER_API_BASE}/api/v4/tokens`);
    
    if (!response.ok) {
      throw new Error(`فشل جلب العملات: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ تم جلب ${Object.keys(data).length} عملة`);
    
    // تحويل البيانات إلى الصيغة المطلوبة
    return Object.values(data).map(token => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI,
      tags: token.tags || [],
      chainId: token.chainId || 101,
    }));
  } catch (error) {
    console.error('❌ خطأ في جلب العملات:', error);
    // عملات افتراضية للطوارئ
    return getDefaultTokens();
  }
};

// دالة لجلب الاقتباس الحقيقي من Jupiter
export const fetchQuoteViaRest = async (
  inputMint,
  outputMint,
  amount,
  slippageBps = 50,
  swapMode = 'ExactIn'
) => {
  try {
    console.log('📊 جلب سعر حقيقي من Jupiter...', {
      inputMint: inputMint.substring(0, 8),
      outputMint: outputMint.substring(0, 8),
      amount,
      slippageBps
    });

    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      swapMode,
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false',
    });

    const response = await fetch(`${JUPITER_API_BASE}/api/v4/quote?${params}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`فشل جلب السعر: ${response.status} - ${errorText}`);
    }

    const quote = await response.json();
    
    if (!quote || quote.error) {
      throw new Error(quote.error || 'لا يوجد سعر متاح');
    }

    console.log('✅ تم جلب السعر الحقيقي:', {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct
    });

    return quote;
  } catch (error) {
    console.error('❌ خطأ في جلب السعر:', error);
    throw error;
  }
};

// دالة لإنشاء معاملة swap حقيقية
export const createSwapTransaction = async (
  quote,
  userPublicKey,
  wrapAndUnwrapSol = true
) => {
  try {
    console.log('🔄 إنشاء معاملة swap حقيقية...');

    const body = {
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol,
    };

    const response = await fetch(`${JUPITER_API_BASE}/api/v4/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`فشل إنشاء المعاملة: ${response.status} - ${errorText}`);
    }

    const swapData = await response.json();
    
    if (!swapData.swapTransaction) {
      throw new Error('لا يوجد بيانات معاملة');
    }

    console.log('✅ تم إنشاء معاملة swap حقيقية');
    return swapData;
  } catch (error) {
    console.error('❌ خطأ في إنشاء المعاملة:', error);
    throw error;
  }
};

// دالة تنفيذ swap حقيقية
export const executeSwapViaRest = async (quote, userPublicKey, signTransactionFunction) => {
  try {
    console.log('🚀 بدء تنفيذ swap حقيقي...');

    // 1. إنشاء معاملة swap
    const swapData = await createSwapTransaction(quote, userPublicKey);
    
    // 2. تحويل transaction data من base64 إلى binary
    const swapTransactionBuffer = Buffer.from(swapData.swapTransaction, 'base64');
    
    // 3. إنشاء VersionedTransaction
    const transaction = VersionedTransaction.deserialize(swapTransactionBuffer);
    
    // 4. توقيع المعاملة باستخدام الدالة الموردة
    const signedTransaction = await signTransactionFunction(transaction);
    
    // 5. إرسال المعاملة إلى الشبكة
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const rawTransaction = signedTransaction.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    console.log('📤 تم إرسال المعاملة:', signature);
    
    // 6. انتظار تأكيد المعاملة
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: transaction.message.recentBlockhash,
      lastValidBlockHeight: transaction.message.lastValidBlockHeight,
    });
    
    if (confirmation.value.err) {
      throw new Error(`فشل المعاملة: ${confirmation.value.err.toString()}`);
    }
    
    console.log('✅ تم تنفيذ swap بنجاح:', signature);
    
    return {
      success: true,
      txid: signature,
      quote: quote,
      amountIn: quote.inAmount,
      amountOut: quote.outAmount,
    };
  } catch (error) {
    console.error('❌ خطأ في تنفيذ swap:', error);
    return {
      success: false,
      error: error.message,
      txid: null,
    };
  }
};

// دوال مساعدة
export const amountToBaseUnits = (amount, decimals) => {
  return Math.floor(amount * Math.pow(10, decimals));
};

export const baseUnitsToAmount = (baseUnits, decimals) => {
  return baseUnits / Math.pow(10, decimals);
};

// دالة للحصول على اتصال Solana
export const getSolanaConnection = () => {
  return new Connection(RPC_ENDPOINT, 'confirmed');
};

// عملات افتراضية للطوارئ
const getDefaultTokens = () => {
  return [
    {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      tags: ['solana', 'native'],
    },
    {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
      tags: ['stablecoin', 'usd'],
    },
    {
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
      tags: ['stablecoin', 'usd'],
    },
    {
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      name: 'Bonk',
      decimals: 5,
      logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
      tags: ['meme'],
    },
    {
      address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      symbol: 'JUP',
      name: 'Jupiter',
      decimals: 6,
      logoURI: 'https://static.jup.ag/jup/icon.png',
      tags: ['utility'],
    },
  ];
};
