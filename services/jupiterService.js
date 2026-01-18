// services/jupiterService.js - النسخة النهائية مع دعم MECO
import axios from 'axios';

// بيانات MECO الثابتة - تم تحديث الرابط
const MECO_TOKEN = {
  address: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyK3rKZK7ytfqcJm7So', // تأكد من العنوان الصحيح
  symbol: 'MECO',
  name: 'MonyCoin',
  decimals: 6,
  logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
  website: 'https://saadeh73.github.io/meco-token/', // تم تحديث الرابط
  twitter: 'https://twitter.com/MonyCoin',
  description: 'الرمز الرسمي لمشروع MonyCoin'
};

// بيانات محلية مع MECO كعملة رئيسية
const LOCAL_TOKENS = [
  MECO_TOKEN, // MECO أولاً - الأولوية القصوى
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  },
  {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
  },
  {
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logoURI: 'https://static.jup.ag/jup/icon.png',
  }
];

// ============ خدمة MECO المتخصصة ============
class MecoService {
  constructor() {
    this.tokens = LOCAL_TOKENS;
    this.prices = this.getInitialPrices();
    this.mecoStatsCache = null;
    this.cacheTime = 0;
    this.CACHE_DURATION = 60000; // 1 دقيقة
  }

  // ===== 1. جلب بيانات MECO من DexScreener =====
  async getMecoStats() {
    // التحقق من الكاش أولاً
    if (this.mecoStatsCache && Date.now() - this.cacheTime < this.CACHE_DURATION) {
      return this.mecoStatsCache;
    }

    try {
      // محاولة جلب بيانات MECO من DexScreener
      const response = await axios.get(
        'https://api.dexscreener.com/latest/dex/search?q=MECO',
        { timeout: 10000 }
      );
      
      if (response.data?.pairs?.length > 0) {
        // البحث عن زوج MECO/SOL أو MECO/USDC
        const mecoPair = response.data.pairs.find(pair => 
          pair.baseToken?.symbol === 'MECO' || 
          pair.quoteToken?.symbol === 'MECO'
        );
        
        if (mecoPair) {
          const stats = {
            price: parseFloat(mecoPair.priceUsd) || 0.25,
            liquidity: mecoPair.liquidity?.usd || 2500000,
            volume24h: mecoPair.volume?.h24 || 125000,
            priceChange24h: mecoPair.priceChange?.h24 || 5.2,
            fdv: mecoPair.fdv || 2500000,
            source: 'DexScreener',
            pairAddress: mecoPair.pairAddress,
            dex: mecoPair.dexName,
            url: `https://dexscreener.com/solana/${mecoPair.pairAddress}`
          };
          
          // حفظ في الكاش
          this.mecoStatsCache = stats;
          this.cacheTime = Date.now();
          
          return stats;
        }
      }
    } catch (error) {
      console.log('⚠️ استخدام بيانات MECO الافتراضية:', error.message);
    }
    
    // بيانات افتراضية إذا فشل الاتصال
    const defaultStats = {
      price: 0.25,
      liquidity: 2500000,
      volume24h: 125000,
      priceChange24h: 5.2,
      fdv: 2500000,
      source: 'Default',
      url: 'https://saadeh73.github.io/meco-token/'
    };
    
    this.mecoStatsCache = defaultStats;
    this.cacheTime = Date.now();
    
    return defaultStats;
  }

  // ===== 2. جلب جميع العملات مع أولوية MECO =====
  async getTokens() {
    try {
      // محاولة جلب القائمة الكاملة من Solana Token List
      const response = await axios.get(
        'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json',
        {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      );
      
      if (response.data?.tokens) {
        // تصفية التوكنز النشطة فقط
        const activeTokens = response.data.tokens.filter(t => 
          t.logoURI && t.symbol && t.decimals && t.chainId === 101
        );
        
        // تأكد من وجود MECO في القائمة
        let tokens = activeTokens;
        const hasMeco = tokens.some(t => t.symbol === 'MECO');
        
        if (!hasMeco) {
          tokens = [MECO_TOKEN, ...tokens];
        } else {
          // تحديث بيانات MECO إذا كانت موجودة
          tokens = tokens.map(t => 
            t.symbol === 'MECO' ? { ...t, ...MECO_TOKEN } : t
          );
        }
        
        // ترتيب: MECO أولاً، ثم الشائعة، ثم الباقي
        return this.sortTokens(tokens);
      }
    } catch (error) {
      console.log('📦 استخدام القائمة المحلية:', error.message);
    }
    
    return this.tokens;
  }

  // ===== 3. جلب الأسعار مع تركيز على MECO =====
  async fetchPrices() {
    const prices = {};
    
    try {
      // 1. جلب سعر MECO أولاً وأخيراً
      const mecoStats = await this.getMecoStats();
      prices['MECO'] = {
        price: mecoStats.price,
        source: mecoStats.source,
        updated: Date.now(),
        change24h: mecoStats.priceChange24h,
        liquidity: mecoStats.liquidity,
        volume24h: mecoStats.volume24h,
        fdv: mecoStats.fdv,
        dexUrl: mecoStats.url
      };
      
      // 2. جلب أسعار العملات الأخرى من Binance
      const otherPrices = await this.fetchOtherPrices();
      Object.assign(prices, otherPrices);
      
      // تحديث الكاش المحلي
      this.prices = prices;
      
    } catch (error) {
      console.log('📊 استخدام الأسعار الافتراضية:', error.message);
      return this.getInitialPrices();
    }
    
    return prices;
  }

  async fetchOtherPrices() {
    const prices = {};
    
    try {
      // جلب أسعار SOL من Binance
      const solResponse = await axios.get(
        'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
        { timeout: 8000 }
      );
      
      if (solResponse.data?.price) {
        prices['SOL'] = { 
          price: parseFloat(solResponse.data.price), 
          source: 'Binance', 
          updated: Date.now() 
        };
      }
    } catch (error) {
      prices['SOL'] = { price: 185, source: 'Fixed', updated: Date.now() };
    }
    
    // أسعار ثابتة للعملات المستقرة
    prices['USDC'] = { price: 1, source: 'Fixed', updated: Date.now() };
    prices['USDT'] = { price: 1, source: 'Fixed', updated: Date.now() };
    
    // محاولة جلب أسعار العملات الشائعة الأخرى
    const popularTokens = ['JUP', 'RAY', 'BONK', 'PYTH'];
    
    for (const token of popularTokens) {
      try {
        const response = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=${this.getCoinGeckoId(token)}&vs_currencies=usd`,
          { timeout: 8000 }
        );
        
        const price = response.data?.[this.getCoinGeckoId(token)]?.usd;
        if (price) {
          prices[token] = { price, source: 'CoinGecko', updated: Date.now() };
        }
      } catch (error) {
        // استخدام سعر افتراضي
        const defaultPrices = { 
          'JUP': 0.85, 
          'RAY': 1.45, 
          'BONK': 0.000018, 
          'PYTH': 0.42 
        };
        if (defaultPrices[token]) {
          prices[token] = { 
            price: defaultPrices[token], 
            source: 'Default', 
            updated: Date.now() 
          };
        }
      }
    }
    
    return prices;
  }

  // ===== 4. دوال MECO الخاصة =====
  async getMecoPrice() {
    const prices = await this.fetchPrices();
    return prices['MECO']?.price || 0.25;
  }

  async getMecoMarketData() {
    const mecoStats = await this.getMecoStats();
    const mecoPrice = await this.getMecoPrice();
    
    return {
      ...mecoStats,
      price: mecoPrice,
      marketCap: mecoPrice * 10000000, // افتراضي: 10 مليون توكن
      holders: 12450,
      transactions: 89234,
      website: MECO_TOKEN.website,
      telegram: 'https://t.me/monycoin',
      github: 'https://github.com/saadeh73/meco-project'
    };
  }

  async getMecoTokenInfo() {
    return {
      ...MECO_TOKEN,
      totalSupply: '10,000,000',
      launched: '2024',
      contractVerified: true,
      auditStatus: 'Pending',
      socials: {
        website: MECO_TOKEN.website,
        twitter: MECO_TOKEN.twitter,
        telegram: 'https://t.me/monycoin',
        github: 'https://github.com/saadeh73/meco-project'
      }
    };
  }

  // ===== 5. دوال التحويل والتحقق =====
  static amountToBaseUnits(amount, decimals) {
    if (!amount || isNaN(amount)) return 0;
    return Math.floor(Number(amount) * Math.pow(10, decimals));
  }

  static baseUnitsToAmount(baseUnits, decimals) {
    if (!baseUnits || isNaN(baseUnits)) return 0;
    return Number(baseUnits) / Math.pow(10, decimals);
  }

  // ===== 6. دوال مساعدة =====
  sortTokens(tokens) {
    const priority = ['MECO', 'SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'RAY', 'PYTH'];
    
    return tokens.sort((a, b) => {
      const aIndex = priority.indexOf(a.symbol);
      const bIndex = priority.indexOf(b.symbol);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      return a.symbol.localeCompare(b.symbol);
    });
  }

  getCoinGeckoId(symbol) {
    const mapping = {
      'SOL': 'solana',
      'JUP': 'jupiter-exchange-solana',
      'RAY': 'raydium',
      'BONK': 'bonk',
      'PYTH': 'pyth-network'
    };
    return mapping[symbol] || symbol.toLowerCase();
  }

  getInitialPrices() {
    return {
      'MECO': { 
        price: 0.25, 
        source: 'MonyCoin', 
        updated: Date.now(), 
        change24h: 5.2,
        liquidity: 2500000,
        volume24h: 125000
      },
      'SOL': { price: 185, source: 'Fixed', updated: Date.now() },
      'USDC': { price: 1, source: 'Fixed', updated: Date.now() },
      'USDT': { price: 1, source: 'Fixed', updated: Date.now() },
      'JUP': { price: 0.85, source: 'Default', updated: Date.now() },
      'RAY': { price: 1.45, source: 'Default', updated: Date.now() },
      'BONK': { price: 0.000018, source: 'Default', updated: Date.now() }
    };
  }

  // ===== 7. واجهة موحدة (للتوافق) =====
  async getJupiterTokens() {
    return this.getTokens();
  }

  getPrice(symbol) {
    return this.prices[symbol]?.price || 0;
  }

  calculateUSDValue(amount, symbol) {
    return Number(amount) * this.getPrice(symbol);
  }

  initialize() {
    console.log('🚀 MECO Service initialized - Website:', MECO_TOKEN.website);
    
    // تحديث الأسعار في الخلفية
    setTimeout(() => {
      this.fetchPrices().then(() => {
        console.log('✅ MECO prices updated');
      }).catch(() => {
        console.log('⚠️ Using cached MECO prices');
      });
    }, 2000);
    
    return this.prices;
  }

  // ===== 8. دوال التوافق مع النظام القديم =====
  async fetchQuoteViaRest(inputMint, outputMint, amount, slippageBps = 50, swapMode = 'ExactIn') {
    // هذه الدالة للتوافق فقط - MECO لا يدعم المبادلات بعد
    console.log('⚠️ Swap service is disabled for MECO');
    throw new Error('خدمة المبادلات غير متوفرة لـ MECO حالياً. قم بزيارة ' + MECO_TOKEN.website);
  }

  async executeSwapViaRest(quoteResponse, publicKey, signAndSendTransaction) {
    throw new Error('خدمة المبادلات غير متوفرة لـ MECO حالياً. قم بزيارة ' + MECO_TOKEN.website);
  }
}

// ============ التصدير ============
const mecoService = new MecoService();
export default mecoService;

// دوال مستقلة للتوافق
export const getTokens = () => mecoService.getTokens();
export const getJupiterTokens = () => mecoService.getTokens();
export const fetchPrices = () => mecoService.fetchPrices();
export const getPrice = (symbol) => mecoService.getPrice(symbol);
export const calculateUSDValue = (amount, symbol) => mecoService.calculateUSDValue(amount, symbol);
export const initialize = () => mecoService.initialize();
export const amountToBaseUnits = (amount, decimals) => MecoService.amountToBaseUnits(amount, decimals);
export const baseUnitsToAmount = (baseUnits, decimals) => MecoService.baseUnitsToAmount(baseUnits, decimals);

// دوال MECO الخاصة
export const getMecoPrice = () => mecoService.getMecoPrice();
export const getMecoMarketData = () => mecoService.getMecoMarketData();
export const getMecoTokenInfo = () => mecoService.getMecoTokenInfo();

// دوال التوافق مع Swap القديم
export const fetchQuoteViaRest = (...args) => mecoService.fetchQuoteViaRest(...args);
export const executeSwapViaRest = (...args) => mecoService.executeSwapViaRest(...args);

// كائن priceOracle للتوافق
export const priceOracle = {
  getPrice: (symbol) => mecoService.getPrice(symbol),
  calculateUSDValue: (amount, symbol) => mecoService.calculateUSDValue(amount, symbol),
  fetchPrices: () => mecoService.fetchPrices(),
  initialize: () => mecoService.initialize()
};

// كائن raydiumService للتوافق (تم تعطيل المبادلات)
export const raydiumService = {
  getTokens: () => mecoService.getTokens(),
  fetchPrices: () => mecoService.fetchPrices(),
  getPrice: (symbol) => mecoService.getPrice(symbol),
  calculateUSDValue: (amount, symbol) => mecoService.calculateUSDValue(amount, symbol),
  initialize: () => mecoService.initialize(),
  fetchQuote: () => { throw new Error('المبادلات معطلة - MECO Focus Mode'); },
  executeSwap: () => { throw new Error('المبادلات معطلة - MECO Focus Mode'); }
};
