import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons, FontAwesome } from '@expo/vector-icons';

export default function MecoScreen() {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === 'dark';
  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';
  const green = '#00b97f';
  const linkColor = '#1e90ff';
  const cardBg = isDark ? '#111' : '#f7f7f7';

  const [holders, setHolders] = useState(null);
  const scaleAnim = new Animated.Value(1);

  useEffect(() => {
    fetchHolders();
  }, []);

  const fetchHolders = async () => {
    try {
      const res = await fetch(
        'https://api.helius.xyz/v0/token-metadata?mint=7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i&api-key=hel1'
      );
      const data = await res.json();
      setHolders(data?.totalAccounts || 0);
    } catch (e) {
      setHolders('~');
    }
  };

  const handleShare = () => {
    Share.share({
      title: 'Meco Wallet',
      message: 'جرب أول محفظة رقمية عربية تدعم رمز MECO: https://monycoin1.blogspot.com/',
    });
  };

  const openURL = (url) => {
    Linking.openURL(url).catch(() => {});
  };

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

  const Card = ({ title, value, icon }) => (
    <Animated.View style={[styles.card, { backgroundColor: cardBg, transform: [{ scale: scaleAnim }] }]}>
      <Text style={[styles.cardTitle, { color: green }]}>{icon} {title}</Text>
      <Text style={[styles.cardValue, { color: fg }]}>{value}</Text>
    </Animated.View>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: bg }]}>
      {/* العنوان */}
      <Text style={[styles.title, { color: fg }]}>{t('meco_title')}</Text>
      <Text style={[styles.description, { color: fg }]}>{t('meco_description')}</Text>

      {/* بطاقة السعر */}
      <Card title="السعر الحالي" value="0.006 USDT" icon="💰" />

      {/* بطاقة المحافظ والرسوم */}
      <Animated.View style={[styles.card, { backgroundColor: cardBg, transform: [{ scale: scaleAnim }] }]}>
        <Text style={[styles.cardTitle, { color: green }]}>👥 المحافظ المالكة</Text>
        {holders === null ? <ActivityIndicator size="small" color={green} /> : <Text style={[styles.cardValue, { color: fg }]}>{holders}</Text>}
        <Text style={[styles.cardTitle, { color: green, marginTop: 10 }]}>🔁 رسوم التحويل المجمعة</Text>
        <Text style={[styles.cardValue, { color: fg }]}>0.0008 SOL</Text>
      </Animated.View>

      {/* الروابط */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color: green, marginBottom: 10 }]}>روابط مهمة</Text>

        <AnimatedTouchable style={styles.linkRow} onPress={() => { animatePress(); openURL('https://t.me/monycoin1'); }}>
          <Ionicons name="logo-telegram" size={20} color={linkColor} style={styles.icon} />
          <Text style={[styles.link, { color: linkColor }]}>قناة تليجرام</Text>
        </AnimatedTouchable>

        <AnimatedTouchable style={styles.linkRow} onPress={() => { animatePress(); openURL('https://monycoin1.blogspot.com/'); }}>
          <FontAwesome name="globe" size={20} color={linkColor} style={styles.icon} />
          <Text style={[styles.link, { color: linkColor }]}>الموقع الرسمي</Text>
        </AnimatedTouchable>

        <AnimatedTouchable style={styles.linkRow} onPress={() => { animatePress(); openURL('https://x.com/MoniCoinMECO'); }}>
          <FontAwesome name="twitter" size={20} color={linkColor} style={styles.icon} />
          <Text style={[styles.link, { color: linkColor }]}>تابعنا على X</Text>
        </AnimatedTouchable>

        <AnimatedTouchable style={styles.linkRow} onPress={() => { animatePress(); openURL('https://www.facebook.com/MonyCoim?mibextid=ZbWKwL'); }}>
          <FontAwesome name="facebook" size={20} color={linkColor} style={styles.icon} />
          <Text style={[styles.link, { color: linkColor }]}>تابعنا على فيسبوك</Text>
        </AnimatedTouchable>

        <AnimatedTouchable style={styles.linkRow} onPress={() => { animatePress(); handleShare(); }}>
          <Ionicons name="share-social" size={20} color={linkColor} style={styles.icon} />
          <Text style={[styles.link, { color: linkColor }]}>شارك التطبيق</Text>
        </AnimatedTouchable>
      </View>

      {/* ملاحظة وخطة مستقبلية */}
      <Text style={[styles.note, { color: fg }]}>
        قريبا: إمكانية تتبع الرسوم وتحليلات مباشرة من داخل التطبيق، مع تحديثات MECO على X وفيسبوك.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    padding: 15,
    borderRadius: 14,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  links: {
    width: '100%',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  icon: {
    width: 24,
    textAlign: 'center',
  },
  link: {
    fontSize: 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  note: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
});
