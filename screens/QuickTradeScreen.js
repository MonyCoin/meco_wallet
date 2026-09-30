// screens/QuickTradeScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Platform, Image, SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFullChartData } from '../services/priceChartService';
import { getJupiterMarketData, CORE_TOKENS } from '../services/jupiterMarketService';

const { width, height } = Dimensions.get('window');
const CHART_H = Math.round(height * 0.38);

const TIMEFRAMES = [
  { label: '1D',  days: 1   },
  { label: '7D',  days: 7   },
  { label: '30D', days: 30  },
  { label: '3M',  days: 90  },
  { label: '1Y',  days: 365 },
];

const buildChartHtml = (isDark, accent) => `
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:${isDark?'#111122':'#FFFFFF'}}#chart{width:100%;height:100vh}
#tt{position:absolute;top:12px;left:12px;z-index:100;background:${isDark?'rgba(17,17,34,.94)':'rgba(255,255,255,.94)'};border:1px solid ${isDark?'#1E1E38':'#E8E8F2'};border-radius:10px;padding:8px 12px;font-size:12px;color:${isDark?'#EEEEFF':'#0D0D1A'};display:none;font-family:-apple-system,sans-serif}
#tt span{display:block;margin:1px 0}.l{color:${isDark?'#7E7EAA':'#8A8A9E'};font-size:11px}.v{font-weight:700;font-size:13px}.u{color:#10B981}.d{color:#EF4444}</style>
</head><body><div id="chart"></div>
<div id="tt"><span class="l" id="tt_t"></span><span class="v" id="tt_o"></span><span class="v u" id="tt_h"></span><span class="v d" id="tt_l"></span><span class="v" id="tt_c"></span></div>
<script>
const chart=LightweightCharts.createChart(document.getElementById('chart'),{
  width:window.innerWidth,height:window.innerHeight,
  layout:{background:{type:'solid',color:'${isDark?'#111122':'#FFFFFF'}'},textColor:'${isDark?'#7E7EAA':'#8A8A9E'}',fontSize:11},
  grid:{vertLines:{color:'${isDark?'#1E1E38':'#F4F5F9'}'},horzLines:{color:'${isDark?'#1E1E38':'#F4F5F9'}'}},
  crosshair:{mode:LightweightCharts.CrosshairMode.Normal,
    vertLine:{color:'${accent}80',width:1,style:0,labelBackgroundColor:'${accent}'},
    horzLine:{color:'${accent}80',width:1,style:0,labelBackgroundColor:'${accent}'}},
  rightPriceScale:{borderColor:'${isDark?'#1E1E38':'#F4F5F9'}'},
  timeScale:{borderColor:'${isDark?'#1E1E38':'#F4F5F9'}',timeVisible:true,secondsVisible:false},
  handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true},
  handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
});
const candles=chart.addCandlestickSeries({upColor:'#10B981',downColor:'#EF4444',borderUpColor:'#10B981',borderDownColor:'#EF4444',wickUpColor:'#10B981',wickDownColor:'#EF4444'});
const vol=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'vol',color:'#3B82F620'});
chart.priceScale('vol').applyOptions({scaleMargins:{top:0.85,bottom:0}});
chart.subscribeCrosshairMove(p=>{
  if(!p.time||!p.seriesData.size){document.getElementById('tt').style.display='none';return;}
  const d=p.seriesData.get(candles);if(!d)return;
  const dt=new Date(p.time*1000);
  document.getElementById('tt_t').textContent=dt.toLocaleDateString();
  document.getElementById('tt_o').textContent='O: '+d.open.toFixed(6);
  document.getElementById('tt_h').textContent='H: '+d.high.toFixed(6);
  document.getElementById('tt_l').textContent='L: '+d.low.toFixed(6);
  document.getElementById('tt_c').textContent='C: '+d.close.toFixed(6);
  document.getElementById('tt').style.display='block';
});
window.setChartData=function(cd,vd,dec){
  if(!cd||!cd.length)return;
  candles.setData(cd);if(vd&&vd.length)vol.setData(vd);
  candles.applyOptions({priceFormat:{type:'price',precision:dec||6,minMove:Math.pow(10,-(dec||6))}});
  chart.timeScale().fitContent();
};
window.addEventListener('resize',()=>chart.resize(window.innerWidth,window.innerHeight));
</script></body></html>`;

const fmtPrice = (p) => {
  if (p === undefined || p === null || p === 0) return '$0.00';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.001) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  const pStr = p.toFixed(12);
  const m = pStr.match(/^0\.(0+)/);
  if (m) {
    const z = m[1].length;
    if (z >= 4) {
      const subs = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
      const subStr = z.toString().split('').map(d => subs[parseInt(d)]).join('');
      const sig = pStr.slice(2 + z).slice(0, 4).replace(/0+$/, '');
      return `$0.0${subStr}${sig}`;
    }
  }
  return `$${p.toFixed(8).replace(/\.?0+$/, '')}`;
};

const fmtBig = (n) => {
  if (!n) return 'N/A';
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

const SafeImage = ({ uri, size = 32 }) => {
  const [err, setErr] = useState(false);
  if (err || !uri) return <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:'rgba(0,0,0,0.1)' }} />;
  return <Image source={{ uri }} style={{ width:size, height:size, borderRadius:size/2 }} onError={() => setErr(true)} />;
};

export default function QuickTradeScreen() {
  const navigation   = useNavigation();
  const route        = useRoute();
  const { t }        = useTranslation();
  const theme        = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor || '#6C63FF');
  const isDark       = theme === 'dark';
  const insets       = useSafeAreaInsets();

  const C = {
    bg:      isDark ? '#07070F' : '#F4F5F9',
    card:    isDark ? '#111122' : '#FFFFFF',
    card2:   isDark ? '#171730' : '#ECECF4',
    text:    isDark ? '#EEEEFF' : '#1C1C24',
    muted:   isDark ? '#7E7EAA' : '#8A8A9E',
    border:  isDark ? '#1E1E38' : '#E8E8F2',
    success: '#10B981', error: '#EF4444', warning: '#F59E0B',
  };

  const initialToken = route.params?.token
    || CORE_TOKENS.find(tk => tk.symbol === 'SOL')
    || CORE_TOKENS[0];

  const [token,        setToken]        = useState(initialToken);
  const [timeframe,    setTimeframe]    = useState(TIMEFRAMES[0]);
  const [chartLoading, setChartLoading] = useState(true);
  const [marketLoading,setMarketLoading]= useState(true);
  const [priceStats,   setPriceStats]   = useState({ current:0, change:0, high:0, low:0, volume:0, open:0 });

  const webviewRef  = useRef(null);
  const chartHtml   = buildChartHtml(isDark, primaryColor);
  const chartReady  = useRef(false);
  const pendingData = useRef(null);

  const fetchMarket = useCallback(async () => {
    try {
      setMarketLoading(true);
      const data = await getJupiterMarketData();
      const tok  = data.find(d => d.mint === token.mint);
      if (tok) {
        setPriceStats(prev => ({
          ...prev,
          current: tok.current_price || 0,
          change:  tok.price_change_percentage_24h || 0,
        }));
      }
    } catch (_) {}
    finally { setMarketLoading(false); }
  }, [token.mint]);

  const fetchChart = useCallback(async () => {
    try {
      setChartLoading(true);
      chartReady.current = false;
      const result = await getFullChartData(token.symbol, timeframe.days, token.mint);
      if (!result?.data?.length) { setChartLoading(false); return; }

      const price    = result.stats?.currentPrice || 0;
      const decimals = price > 1 ? 2 : price > 0.01 ? 4 : price > 0.0001 ? 6 : 8;

      setPriceStats(prev => ({
        ...prev,
        current: prev.current || price,
        open:    result.stats?.openPrice || 0,
        high:    result.stats?.high || 0,
        low:     result.stats?.low || 0,
        volume:  result.stats?.volume24h || 0,
        change:  prev.change || result.stats?.periodChange || 0,
      }));

      const candleData = result.data.map(d => ({
        time: Math.floor(d.timestamp / 1000),
        open: d.open, high: d.high, low: d.low, close: d.close,
      })).sort((a, b) => a.time - b.time);

      const volData = result.volumeData?.map(v => ({
        time: Math.floor(v.timestamp / 1000),
        value: v.volume,
        color: '#3B82F620',
      })).sort((a, b) => a.time - b.time) || [];

      const js = `window.setChartData(${JSON.stringify(candleData)},${JSON.stringify(volData)},${decimals});true;`;
      if (chartReady.current) webviewRef.current?.injectJavaScript(js);
      else pendingData.current = js;
    } catch (_) {}
    finally { setChartLoading(false); }
  }, [token, timeframe]);

  useEffect(() => { fetchMarket(); }, [token]);
  useEffect(() => { fetchChart();  }, [token, timeframe]);

  const onWebViewLoad = () => {
    chartReady.current = true;
    if (pendingData.current) {
      webviewRef.current?.injectJavaScript(pendingData.current);
      pendingData.current = null;
    }
  };

  const handleBuy  = () => navigation.navigate('TradeExecution', { token, side: 'buy'  });
  const handleSell = () => navigation.navigate('TradeExecution', { token, side: 'sell' });

  const up = priceStats.change >= 0;

  return (
    <SafeAreaView style={[S.root, { backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>

      {/* Header */}
      <View style={[S.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[S.iconBtn, { backgroundColor: C.card2, borderColor: C.border, borderWidth: 1 }]}
        >
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>

        <View style={S.headerCenter}>
          <SafeImage uri={token.image} size={26} />
          <Text style={[S.headerSym, { color: C.text }]}>{token.symbol}</Text>
        </View>

        <TouchableOpacity
          onPress={() => { fetchMarket(); fetchChart(); }}
          style={[S.iconBtn, { backgroundColor: C.card2, borderColor: C.border, borderWidth: 1 }]}
        >
          <Ionicons name="refresh" size={18} color={primaryColor} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>

        {/* Price header */}
        <View style={[S.priceHeader, { backgroundColor: C.card }]}>
          <Text style={[S.priceMain, { color: C.text }]}>
            {marketLoading ? '—' : fmtPrice(priceStats.current)}
          </Text>
          <View style={[S.changePill, { backgroundColor: up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name={up ? 'trending-up' : 'trending-down'} size={12} color={up ? C.success : C.error} />
            <Text style={[S.changeTxt, { color: up ? C.success : C.error }]}>
              {up ? '+' : ''}{priceStats.change.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Chart */}
        <View style={[S.chartWrap, { height: CHART_H, backgroundColor: C.card }]}>
          {chartLoading && (
            <View style={[S.chartOverlay, { backgroundColor: C.card }]}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          )}
          <WebView
            key={`${token.symbol}_${timeframe.label}`}
            ref={webviewRef}
            source={{ html: chartHtml }}
            style={{ flex: 1, backgroundColor: C.card }}
            scrollEnabled={false} bounces={false}
            javaScriptEnabled domStorageEnabled
            onLoad={onWebViewLoad}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
        </View>

        {/* Timeframes */}
        <View style={[S.tfRow, { backgroundColor: C.card, borderTopColor: C.border }]}>
          {TIMEFRAMES.map(tf => (
            <TouchableOpacity
              key={tf.label}
              style={[S.tfBtn, timeframe.label === tf.label && { backgroundColor: primaryColor }]}
              onPress={() => setTimeframe(tf)}
            >
              <Text style={[S.tfTxt, { color: timeframe.label === tf.label ? '#FFF' : C.muted }]}>
                {tf.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Market Stats */}
        <View style={[S.statsCard, { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 }]}>
          <Text style={[S.statsTitle, { color: C.text }]}>{t('market_stats')}</Text>
          <View style={S.statsGrid}>
            {[
              { label: t('ohlc_high'),       value: fmtPrice(priceStats.high) },
              { label: t('ohlc_low'),        value: fmtPrice(priceStats.low)  },
              { label: t('volume_24h_label'),value: fmtBig(priceStats.volume) },
              { label: t('ohlc_open'),       value: fmtPrice(priceStats.open) },
            ].map(item => (
              <View key={item.label} style={[S.statItem, { backgroundColor: C.card2, borderColor: C.border, borderWidth: 1 }]}>
                <Text style={[S.statL, { color: C.muted }]}>{item.label}</Text>
                <Text style={[S.statV, { color: C.text }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Buy / Sell */}
        <View style={S.actionRow}>
          <TouchableOpacity
            style={[S.actionBtn, { backgroundColor: C.success }]}
            onPress={handleBuy}
            activeOpacity={0.85}
          >
            <Ionicons name="trending-up" size={20} color="#FFF" />
            <Text style={S.actionBtnTxt}>{t('buy')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[S.actionBtn, { backgroundColor: C.error }]}
            onPress={handleSell}
            activeOpacity={0.85}
          >
            <Ionicons name="trending-down" size={20} color="#FFF" />
            <Text style={S.actionBtnTxt}>{t('sell')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:  { flex: 1 },
  header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
           paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1 },
  iconBtn:{ width:40, height:40, borderRadius:12, justifyContent:'center', alignItems:'center' },
  headerCenter:{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  headerSym:{ fontSize:18, fontWeight:'800' },

  priceHeader:{ paddingHorizontal:20, paddingVertical:16, alignItems:'flex-start', gap:8 },
  priceMain:{ fontSize:32, fontWeight:'800', letterSpacing:-0.5 },
  changePill:{ flexDirection:'row', alignItems:'center', gap:4,
                paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  changeTxt:{ fontSize:13, fontWeight:'700' },

  chartWrap:{ position:'relative' },
  chartOverlay:{ position:'absolute', top:0, left:0, right:0, bottom:0,
                 justifyContent:'center', alignItems:'center', zIndex:10 },

  tfRow:{ flexDirection:'row', justifyContent:'space-around', paddingVertical:12, borderTopWidth:1 },
  tfBtn:{ paddingHorizontal:14, paddingVertical:7, borderRadius:10 },
  tfTxt:{ fontSize:12, fontWeight:'700' },

  statsCard:{ margin:16, borderRadius:18, padding:16 },
  statsTitle:{ fontSize:14, fontWeight:'800', marginBottom:12 },
  statsGrid:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', rowGap:10 },
  statItem:{ width:'48.5%', padding:14, borderRadius:12 },
  statL:{ fontSize:11, marginBottom:4 },
  statV:{ fontSize:13, fontWeight:'700' },

  actionRow:{ flexDirection:'row', gap:12, paddingHorizontal:16, marginTop:4 },
  actionBtn:{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
              paddingVertical:16, borderRadius:16, gap:8,
              shadowColor:'#000', shadowOpacity:0.15, shadowRadius:8, elevation:3 },
  actionBtnTxt:{ color:'#FFF', fontSize:16, fontWeight:'800' },
});
