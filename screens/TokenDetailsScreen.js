import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Dimensions, ScrollView, SafeAreaView, ActivityIndicator, Alert
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';

const { width } = Dimensions.get('window');

export default function TokenDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor || '#6C63FF');
  const isDark = theme === 'dark';

  // استقبال بيانات العملة
  const { token } = route.params || {};

  const [chartUrl, setChartUrl] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [tokenData, setTokenData] = useState(null);

  const colors = {
    background: isDark ? '#0A0A0F' : '#F8FAFD',
    card: isDark ? '#1A1A2E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    success: '#10B981',
    error: '#EF4444',
    border: isDark ? '#2A2A3E' : '#E5E7EB',
  };

  if (!token) return null;

  const isPositive = token.price_change_percentage_24h >= 0;
  const chartColor = isPositive ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)'; // أخضر أو أحمر

  // جلب بيانات إضافية للعملة (الوصف والروابط)
  useEffect(() => {
    const fetchTokenDetails = async () => {
      if (token.id && token.id !== 'MonyCoin') {
        try {
          const response = await fetch(`https://api.coingecko.com/api/v3/coins/${token.id}`);
          const data = await response.json();
          setTokenData(data);
        } catch (error) {
          console.log('Token details fetch error:', error);
        }
      }
    };
    fetchTokenDetails();
  }, [token]);

  // دالة جلب بيانات الرسم البياني وتوليد الصورة
  useEffect(() => {
    const fetchChartData = async () => {
      // إذا كانت العملة MECO، لا نحاول جلب الشارت حالياً
      if (token.symbol === 'MECO') {
        setLoadingChart(false);
        return;
      }

      try {
        // 1. جلب بيانات أخر 24 ساعة من CoinGecko
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${token.id}/market_chart?vs_currency=usd&days=1`
        );
        const data = await response.json();

        if (data.prices && data.prices.length > 0) {
          // 2. تبسيط البيانات (أخذ نقطة كل 10 نقاط لتقليل حجم الرابط)
          const prices = data.prices
            .filter((_, index) => index % 10 === 0)
            .map(price => price[1]);

          // 3. إنشاء رابط QuickChart
          const chartConfig = {
            type: 'line',
            data: {
              labels: prices.map((_, i) => ''),
              datasets: [{
                data: prices,
                borderColor: chartColor,
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                tension: 0.4,
                backgroundColor: 'transparent'
              }]
            },
            options: {
              legend: { display: false },
              tooltips: { enabled: false },
              scales: {
                xAxes: [{ display: false }],
                yAxes: [{ display: false }]
              },
              elements: {
                line: { borderJoinStyle: 'round' }
              },
              layout: {
                padding: { left: 0, right: 0, top: 0, bottom: 0 }
              }
            }
          };
          
          const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=500&height=200&backgroundColor=transparent`;
          setChartUrl(url);
        }
      } catch (error) {
        console.log('Chart fetch error:', error);
      } finally {
        setLoadingChart(false);
      }
    };

    fetchChartData();
  }, [token]);

  const copyContractAddress = async () => {
    if (token.mint) {
      await Clipboard.setStringAsync(token.mint);
      Alert.alert(t('copied'), t('copied_to_clipboard'));
    }
  };

  // تنسيق الأرقام الكبيرة
  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + ' K';
    return num.toLocaleString();
  };

  // الحصول على وصف العملة
  const getDescription = () => {
    if (token.symbol === 'MECO') {
      return t('meco_description') || 'MECO is a digital currency built on the Solana network, designed for fast, secure, and low-cost micro-payments.';
    }
    return tokenData?.description?.en || t('no_description');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={[styles.backBtn, { backgroundColor: colors.card }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        {/* اسم العملة ورمزها في المنتصف */}
        <View style={{alignItems: 'center'}}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{token.name}</Text>
          <Text style={{color: colors.textSecondary, fontSize: 12}}>{token.symbol}</Text>
        </View>
        
        {/* أيقونة صغيرة للعملة في اليمين */}
        <Image source={{ uri: token.image }} style={styles.headerIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* 1. السعر والتغير */}
        <View style={styles.priceContainer}>
          <Text style={[styles.priceText, { color: colors.text }]}>
            ${token.current_price?.toLocaleString('en-US', { maximumFractionDigits: 6 })}
          </Text>
          <View style={[styles.changeBadge, { backgroundColor: isPositive ? colors.success + '20' : colors.error + '20' }]}>
            <Ionicons name={isPositive ? "caret-up" : "caret-down"} size={16} color={isPositive ? colors.success : colors.error} />
            <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.error }]}>
              {Math.abs(token.price_change_percentage_24h || 0).toFixed(2)}% ({t('price_change_24h')})
            </Text>
          </View>
        </View>

        {/* 2. الرسم البياني */}
        <View style={styles.chartContainer}>
          {loadingChart ? (
            <ActivityIndicator size="large" color={primaryColor} />
          ) : chartUrl ? (
            <Image 
              source={{ uri: chartUrl }} 
              style={styles.chartImage} 
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoContainer}>
               <Image source={{ uri: token.image }} style={styles.largeLogo} />
               <Text style={[styles.noChartText, {color: colors.textSecondary}]}>{t('chart_coming_soon')}</Text>
            </View>
          )}
        </View>

        {/* 3. أزرار الإجراءات */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: primaryColor }]}
            onPress={() => navigation.navigate('Send', { preselectedToken: token.symbol })}
          >
            <Ionicons name="paper-plane-outline" size={20} color="#FFF" />
            <Text style={styles.actionText}>{t('send')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: primaryColor }]}
            onPress={() => navigation.navigate('Receive')}
          >
            <Ionicons name="qr-code-outline" size={20} color={primaryColor} />
            <Text style={[styles.actionText, { color: primaryColor }]}>{t('receive')}</Text>
          </TouchableOpacity>
        </View>

        {/* 4. الإحصائيات */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('statistics')}</Text>
        
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('market_cap')}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>${formatNumber(token.market_cap)}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('volume_24h')}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>${formatNumber(token.total_volume)}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('rank')}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>#{token.rank || 'N/A'}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('high_24h')}</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>
              ${token.high_24h?.toLocaleString() || '0'}
            </Text>
          </View>
        </View>

        {/* 5. عنوان العقد (إذا كان متاحاً) */}
        {token.mint && (
          <View style={[styles.contractCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.contractLabel, { color: colors.text }]}>{t('contract_address')}</Text>
            <View style={styles.contractRow}>
              <Text style={[styles.contractAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                {token.mint}
              </Text>
              <TouchableOpacity onPress={copyContractAddress} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 6. الوصف */}
        <View style={[styles.descriptionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.descriptionTitle, { color: colors.text }]}>{t('about_token')}</Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {getDescription()}
          </Text>
        </View>

        {/* 7. الروابط */}
        {(tokenData?.links?.homepage?.[0] || tokenData?.links?.twitter_screen_name) && (
          <View style={styles.linksContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('links')}</Text>
            <View style={styles.linksGrid}>
              {tokenData?.links?.homepage?.[0] && (
                <TouchableOpacity style={[styles.linkBtn, { backgroundColor: colors.card }]}>
                  <Ionicons name="globe-outline" size={20} color={primaryColor} />
                  <Text style={[styles.linkText, { color: colors.text }]}>{t('website')}</Text>
                </TouchableOpacity>
              )}
              {tokenData?.links?.twitter_screen_name && (
                <TouchableOpacity style={[styles.linkBtn, { backgroundColor: colors.card }]}>
                  <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                  <Text style={[styles.linkText, { color: colors.text }]}>{t('twitter')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerIcon: { width: 30, height: 30, borderRadius: 15 },
  
  content: { padding: 20 },
  
  priceContainer: { alignItems: 'center', marginBottom: 20 },
  priceText: { fontSize: 36, fontWeight: 'bold', marginBottom: 8 },
  changeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  changeText: { fontWeight: 'bold', marginLeft: 4 },

  chartContainer: { 
    height: 200, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 30,
    marginTop: 10
  },
  chartImage: { width: width - 40, height: 200 },
  
  logoContainer: { alignItems: 'center', justifyContent: 'center' },
  largeLogo: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, opacity: 0.8 },
  noChartText: { fontSize: 12, fontStyle: 'italic' },

  actionsContainer: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  actionBtn: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, gap: 8, elevation: 2
  },
  actionText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: (width - 50) / 2, padding: 16, borderRadius: 16 },
  statLabel: { fontSize: 12, marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: 'bold' },

  contractCard: { padding: 16, borderRadius: 16, marginBottom: 20 },
  contractLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  contractRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contractAddress: { flex: 1, fontSize: 14 },
  copyBtn: { padding: 8 },

  descriptionCard: { padding: 16, borderRadius: 16, marginBottom: 20 },
  descriptionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  descriptionText: { fontSize: 14, lineHeight: 20 },

  linksContainer: { marginBottom: 20 },
  linksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  linkBtn: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    gap: 8
  },
  linkText: { fontSize: 14, fontWeight: '500' }
});
