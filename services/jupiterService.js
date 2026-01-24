// services/jupiterService.js - كامل ومستقل
const JUPITER_API_BASE = 'https://api.jup.ag';

// بيانات MECO الثابتة
const MECO_TOKEN = {
  address: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyK3rKZK7ytfqcJm7So',
  symbol: 'MECO',
  name: 'MonyCoin',
  decimals: 6,
  logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
  currentPrice: 0.00617
};

// 1. دالة جلب العملات - أبسط نسخة
export const getTokens = async () => {
  try {
    console.log('🔄 جلب العملات...');
    
    // عملات أساسية فقط
    const defaultTokens = [
      MECO_TOKEN,
      {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      },
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
      },
      {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png'
      },
      {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        symbol: 'JUP',
        name: 'Jupiter',
        decimals: 6,
        logoURI: 'https://static.jup.ag/jup/icon.png'
      }
    ];
    
    return defaultTokens;
    
  } catch (error) {
    console.error('❌ خطأ في جلب العملات:', error);
    // أقل قائمة ضرورية
    return [
      MECO_TOKEN,
      {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      }
    ];
  }
};

// 2. دالة جلب الأسعار - حقيقية وبسيطة
export const fetchPrices = async () => {
  try {
    console.log('🔄 جلب الأسعار...');
    
    // جلب أسعار حقيقية فقط لـ SOL و USDC من Jupiter
    const prices = {
      'MECO': { price: 0.00617, source: 'Fixed', updated: Date.now() },
      'USDC': { price: 1, source: 'Fixed', updated: Date.now() },
      'USDT': { price: 1, source: 'Fixed', updated: Date.now() }
    };
    
    // جلب سعر SOL فقط من Jupiter API (أبسط استدعاء)
    try {
      const solMint = 'So11111111111111111111111111111111111111112';
      const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      
      // 1 SOL = ? USDC
      const response = await fetch(
        `${JUPITER_API_BASE}/api/v3/quote?` + 
        `inputMint=${solMint}&` +
        `outputMint=${usdcMint}&` +
        `amount=1000000000&` + // 1 SOL في وحدات القاعدة
        `slippageBps=50&` +
        `swapMode=ExactIn&` +
        `onlyDirectRoutes=false`
      );
      
      if (response.ok) {
        const quote = await response.json();
        if (quote && quote.outAmount) {
          // outAmount بالوحدات الأساسية لـ USDC (6 منازل عشرية)
          const solPrice = quote.outAmount / 1000000; // تحويل إلى USDC
          prices['SOL'] = { 
            price: solPrice, 
            source: 'Jupiter', 
            updated: Date.now(),
            raw: quote 
          };
          console.log('✅ سعر SOL:', solPrice);
        } else {
          throw new Error('لا يوجد اقتباس صالح');
        }
      } else {
        throw new Error(`خطأ API: ${response.status}`);
      }
    } catch (solError) {
      console.warn('⚠️ استخدام سعر افتراضي لـ SOL:', solError.message);
      prices['SOL'] = { price: 185, source: 'Default', updated: Date.now() };
    }
    
    // سعر JUP (افتراضي أو نجلب إذا أردت)
    prices['JUP'] = { price: 0.8, source: 'Default', updated: Date.now() };
    
    console.log('✅ الأسعار المحملة');
    return prices;
    
  } catch (error) {
    console.error('❌ خطأ في جلب الأسعار:', error);
    
    // أسعار طوارئ
    return {
      'MECO': { price: 0.00617, source: 'Fixed', updated: Date.now() },
      'SOL': { price: 185, source: 'Emergency', updated: Date.now() },
      'USDC': { price: 1, source: 'Emergency', updated: Date.now() },
      'USDT': { price: 1, source: 'Emergency', updated: Date.now() },
      'JUP': { price: 0.8, source: 'Emergency', updated: Date.now() }
    };
  }
};

// 3. دالة للـ Swap/Send (تبقى كما هي بدون تغيير)
export const fetchQuoteViaRest = async (inputMint, outputMint, amount, slippageBps = 50) => {
  try {
    const params = new URLSearchParams({
      inputMint: inputMint.toString(),
      outputMint: outputMint.toString(),
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      swapMode: 'ExactIn',
      onlyDirectRoutes: 'false',
    });

    const response = await fetch(`${JUPITER_API_BASE}/api/v3/quote?${params}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`فشل جلب السعر: ${response.status} - ${errorText}`);
    }

    const quote = await response.json();
    
    if (!quote || quote.error) {
      throw new Error(quote?.error || 'لا يوجد سعر متاح');
    }

    return quote;
  } catch (error) {
    console.error('❌ خطأ في جلب السعر:', error);
    throw error;
  }
};
