const JUPITER_BASE = 'https://quote-api.jup.ag/v6';

// دالة مساعدة للتحقق من الاتصال بالإنترنت
const checkNetworkConnection = async () => {
  try {
    const response = await fetch('https://www.google.com', { 
      method: 'HEAD',
      timeout: 5000 
    });
    return true;
  } catch {
    return false;
  }
};

export async function fetchQuoteViaRest(inputMint, outputMint, amountBaseUnits, slippageBps = 50) {
  try {
    // التحقق من الاتصال بالإنترنت أولاً
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      throw new Error('لا يوجد اتصال بالإنترنت. يرجى التحقق من اتصالك.');
    }

    if (!inputMint || !outputMint) throw new Error('اختر العملات');
    if (!amountBaseUnits || amountBaseUnits <= 0) throw new Error('المبلغ غير صحيح');

    const url = `${JUPITER_BASE}/quote` +
      `?inputMint=${inputMint}` +
      `&outputMint=${outputMint}` +
      `&amount=${amountBaseUnits}` +
      `&slippageBps=${slippageBps}` +
      `&onlyDirectRoutes=false` +
      `&maxAccounts=20`;

    console.log('🌐 جاري طلب السعر من Jupiter API...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 ثانية مهلة

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }).catch(error => {
      if (error.name === 'AbortError') {
        throw new Error('انتهت مهلة الاتصال. جاري المحاولة مرة أخرى...');
      }
      throw error;
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errorText = 'خطأ غير معروف';
      try {
        errorText = await res.text();
      } catch {
        // تجاهل إذا لم نتمكن من قراءة نص الخطأ
      }
      
      console.error(`❌ خطأ API (${res.status}):`, errorText);
      
      if (res.status === 400) {
        throw new Error('طلب غير صالح. تأكد من صحة العملات والمبلغ.');
      } else if (res.status === 404) {
        throw new Error('لم يتم العثور على سعر لهذه العملات.');
      } else if (res.status === 429) {
        throw new Error('تم تجاوز الحد الأقصى للطلبات. يرجى الانتظار قليلاً.');
      } else if (res.status >= 500) {
        throw new Error('مشكلة في خادم Jupiter. يرجى المحاولة لاحقاً.');
      } else {
        throw new Error(`خطأ في السعر: ${res.status}`);
      }
    }

    const data = await res.json();
    
    if (!data?.data || data.data.length === 0) {
      throw new Error('لا توجد مسارات متاحة لهذه العملية. جرب عملات أو مبلغ مختلف.');
    }
    
    const quote = data.data[0];
    
    if (!quote.outAmount || Number(quote.outAmount) <= 0) {
      throw new Error('الاقتباس المستلم غير صالح.');
    }

    console.log('✅ تم الحصول على اقتباس بنجاح');
    return quote;
    
  } catch (err) {
    console.error('❌ خطأ في جلب السعر:', err.message);
    
    // إرجاع الخطأ دون بيانات وهمية
    if (err.message.includes('لا يوجد اتصال')) {
      throw new Error('❌ لا يوجد اتصال بالإنترنت. تحقق من اتصالك الشبكي.');
    } else if (err.message.includes('مهلة')) {
      throw new Error('⏱️ انتهت مهلة الاتصال. تحقق من سرعة الإنترنت وحاول مرة أخرى.');
    } else if (err.message.includes('لا توجد مسارات')) {
      throw new Error('🚫 لا توجد سيولة كافية لهذه العملية. جرب مبلغاً أصغر أو عملة أخرى.');
    } else {
      throw new Error(`⚠️ ${err.message}`);
    }
  }
}

export async function executeSwapViaRest(quote, userPublicKey, signAndSend) {
  try {
    console.log('🔄 جاري تحضير معاملة المبادلة...');

    const res = await fetch(`${JUPITER_BASE}/swap`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      }),
      timeout: 30000 // 30 ثانية مهلة للتبديل
    }).catch(error => {
      if (error.name === 'AbortError') {
        throw new Error('انتهت مهلة تنفيذ المبادلة.');
      }
      throw error;
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `فشل التنفيذ: ${res.status}`);
    }

    const data = await res.json();
    
    if (!data?.swapTransaction) {
      throw new Error('لم يتم استلام بيانات المعاملة.');
    }

    console.log('🔧 جاري إرسال المعاملة...');
    const txBuffer = Buffer.from(data.swapTransaction, 'base64');
    const txid = await signAndSend(txBuffer);
    
    console.log('✅ تم تنفيذ المعاملة:', txid);
    return { success: true, txid };
    
  } catch (err) {
    console.error('❌ خطأ في تنفيذ المبادلة:', err.message);
    throw new Error(`فشل تنفيذ المبادلة: ${err.message}`);
  }
}

export async function getJupiterTokens() {
  try {
    console.log('🔄 جاري جلب قائمة العملات...');

    // التحقق من الاتصال أولاً
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    // استخدام واجهة موثوقة لجلب العملات
    const endpoints = [
      'https://tokens.jup.ag/tokens',
      'https://token.jup.ag/tokens',
      'https://cache.jup.ag/tokens'
    ];

    let tokens = [];
    let lastError = null;

    // تجربة جميع الواجهات الاحتياطية
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 جرب الواجهة: ${endpoint}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          
          if (Array.isArray(data) && data.length > 0) {
            console.log(`✅ تم جلب ${data.length} عملة من ${endpoint}`);
            tokens = data;
            break;
          }
        }
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ فشل الواجهة ${endpoint}:`, error.message);
        continue; // جرب الواجهة التالية
      }
    }

    // إذا فشلت جميع الواجهات
    if (tokens.length === 0) {
      console.warn('⚠️ فشل جلب العملات من جميع الواجهات، استخدام القائمة المحلية');
      
      // قائمة العملات المحلية (بدون اتصال)
      return getLocalTokens();
    }

    // تصفية العملات الصالحة
    const validTokens = tokens.filter(token => 
      token && 
      token.address && 
      token.symbol && 
      token.name &&
      token.decimals !== undefined &&
      token.logoURI
    );

    // ترتيب العملات الشهيرة أولاً
    const popularSymbols = ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'RAY', 'WSOL'];
    const sortedTokens = validTokens.sort((a, b) => {
      const aIndex = popularSymbols.indexOf(a.symbol);
      const bIndex = popularSymbols.indexOf(b.symbol);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      return a.symbol.localeCompare(b.symbol);
    });

    // الحد الأقصى لعدد العملات المعروضة
    const maxTokens = 100;
    const limitedTokens = sortedTokens.slice(0, maxTokens);

    console.log(`✅ تم تحضير ${limitedTokens.length} عملة للعرض`);
    return limitedTokens;
    
  } catch (error) {
    console.error('❌ خطأ في جلب العملات:', error.message);
    
    // إرجاع القائمة المحلية في حالة الخطأ
    return getLocalTokens();
  }
}

// دالة مساعدة: القائمة المحلية للعملات (تعمل بدون اتصال)
function getLocalTokens() {
  console.log('📱 استخدام القائمة المحلية للعملات');
  
  return [
    {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      tags: ['raydium']
    },
    {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
      tags: ['stablecoin']
    },
    {
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'USDT',
      decimals: 6,
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
      tags: ['stablecoin']
    },
    {
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      name: 'Bonk',
      decimals: 5,
      logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
      tags: ['memecoin']
    },
    {
      address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      symbol: 'JUP',
      name: 'Jupiter',
      decimals: 6,
      logoURI: 'https://static.jup.ag/jup/icon.png',
      tags: ['utility-token']
    },
    {
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      symbol: 'RAY',
      name: 'Raydium',
      decimals: 6,
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
      tags: ['defi']
    },
    {
      address: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
      symbol: 'MECO',
      name: 'MonyCoin',
      decimals: 6,
      logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
      tags: []
    }
  ];
}

export function amountToBaseUnits(amount, decimals) {
  if (!amount || amount <= 0 || isNaN(amount)) return 0;
  return Math.floor(amount * Math.pow(10, decimals));
}

export function baseUnitsToAmount(baseUnits, decimals) {
  if (!baseUnits || baseUnits <= 0 || isNaN(baseUnits)) return 0;
  return baseUnits / Math.pow(10, decimals);
}

// دالة مساعدة: التحقق من صحة عنوان العملة
export function isValidTokenAddress(address) {
  if (!address || typeof address !== 'string') return false;
  return address.length === 44 || address.length === 43;
}
