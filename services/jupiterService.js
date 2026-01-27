// services/jupiterService.js - معدل مع مصدرين للأسعار
const JUPITER_API_BASE = 'https://api.jup.ag';
const BIRDEYE_API_BASE = 'https://public-api.birdeye.so/public';
// Birdeye API Key - يمكن إضافته في ملف .env لاحقاً
const BIRDEYE_API_KEY = 'YOUR_BIRDEYE_API_KEY'; // احصل على مفتاح مجاني من birdeye.so

// بيانات MECO الثابتة
const MECO_TOKEN = {
  address: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyK3rKZK7ytfqcJm7So',
  symbol: 'MECO',
  name: 'MonyCoin',
  decimals: 6,
  logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
  currentPrice: 0.00617
};

// قائمة العملات الرئيسية
const BASE_TOKENS = [
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

// 1. جلب الأسعار من Jupiter API
async function getPriceFromJupiter(mintAddress) {
  try {
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    // إذا كان العملة هي USDC، نرجع 1
    if (mintAddress === usdcMint) {
      return { price: 1, source: 'Jupiter' };
    }
    
    const response = await fetch(
      `${JUPITER_API_BASE}/api/v3/quote?` +
      `inputMint=${mintAddress}&` +
      `outputMint=${usdcMint}&` +
      `amount=${Math.pow(10, 9)}&` +
      `slippageBps=50&` +
      `swapMode=ExactIn&` +
      `onlyDirectRoutes=true`
    );
    
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.outAmount) {
      const price = data.outAmount / Math.pow(10, 6); // تحويل إلى USDC
      return { price: price, source: 'Jupiter' };
    }
    
    throw new Error('Invalid response from Jupiter');
  } catch (error) {
    console.warn('⚠️ فشل جلب السعر من Jupiter:', error.message);
    return null;
  }
}

// 2. جلب الأسعار من Birdeye API
async function getPriceFromBirdeye(mintAddress, symbol) {
  try {
    // إذا كان العملة هي USDC أو USDT، نرجع 1
    if (symbol === 'USDC' || symbol === 'USDT') {
      return { price: 1, source: 'Birdeye' };
    }
    
    const response = await fetch(
      `${BIRDEYE_API_BASE}/price?address=${mintAddress}`,
      {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.value) {
      return { price: data.data.value, source: 'Birdeye' };
    }
    
    throw new Error('Invalid response from Birdeye');
  } catch (error) {
    console.warn('⚠️ فشل جلب السعر من Birdeye:', error.message);
    return null;
  }
}

// 3. جلب سعر موثوق من مصادر متعددة
async function getReliablePrice(mintAddress, symbol) {
  const sources = [
    () => getPriceFromJupiter(mintAddress),
    () => getPriceFromBirdeye(mintAddress, symbol)
  ];
  
  let lastError;
  
  for (const source of sources) {
    try {
      const result = await source();
      if (result && result.price > 0) {
        return result;
      }
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  
  // إذا فشلت جميع المصادر، نستخدم الأسعار الافتراضية
  console.warn('⚠️ استخدام الأسعار الافتراضية بعد فشل جميع المصادر');
  const defaultPrices = {
    'SOL': { price: 185, source: 'Default' },
    'USDC': { price: 1, source: 'Default' },
    'USDT': { price: 1, source: 'Default' },
    'JUP': { price: 0.8, source: 'Default' },
    'MECO': { price: 0.00617, source: 'Fixed' }
  };
  
  return defaultPrices[symbol] || { price: 0, source: 'Unknown' };
}

// 1. دالة جلب العملات
export const getTokens = async () => {
  try {
    console.log('🔄 جلب العملات...');
    
    // إرجاع قائمة العملات الأساسية مع MECO
    return [
      MECO_TOKEN,
      ...BASE_TOKENS
    ];
    
  } catch (error) {
    console.error('❌ خطأ في جلب العملات:', error);
    // قائمة احتياطية
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

// 2. دالة جلب الأسعار الحية
export const fetchPrices = async () => {
  try {
    console.log('🔄 جلب الأسعار الحية...');
    
    const tokens = [
      ...BASE_TOKENS,
      MECO_TOKEN
    ];
    
    const prices = {};
    const promises = [];
    
    // جلب أسعار جميع العملات بشكل متوازي
    for (const token of tokens) {
      promises.push(
        getReliablePrice(token.address, token.symbol)
          .then(result => {
            prices[token.symbol] = {
              price: result.price,
              source: result.source,
              updated: Date.now()
            };
          })
          .catch(error => {
            console.warn(`⚠️ فشل جلب سعر ${token.symbol}:`, error.message);
            // استخدام سعر افتراضي في حالة الفشل
            const defaultPrice = token.symbol === 'MECO' ? 0.00617 : 
                               token.symbol === 'SOL' ? 185 : 
                               token.symbol === 'JUP' ? 0.8 : 1;
            
            prices[token.symbol] = {
              price: defaultPrice,
              source: 'Emergency',
              updated: Date.now()
            };
          })
      );
    }
    
    await Promise.all(promises);
    
    console.log('✅ الأسعار المحملة بنجاح:', prices);
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

// 3. دالة للـ Swap/Send
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

// 4. دالة جديدة: جلب بيانات السوق (حجم التداول، التغير 24h)
export const fetchMarketData = async (mintAddress) => {
  try {
    if (!BIRDEYE_API_KEY) {
      throw new Error('Birdeye API key not configured');
    }
    
    const response = await fetch(
      `${BIRDEYE_API_BASE}/token_overview?address=${mintAddress}`,
      {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Birdeye market data error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      return {
        volume24h: data.data.volume24h || 0,
        priceChange24h: data.data.priceChange24h || 0,
        liquidity: data.data.liquidity || 0
      };
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ فشل جلب بيانات السوق:', error.message);
    return null;
  }
};
