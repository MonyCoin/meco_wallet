import React, { useEffect, useState, useRef } from 'react';
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

const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';

export default function MecoScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const isDark = theme === 'dark';

  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';
  const cardBg = isDark ? '#111' : '#f6f6f6';
  const green = '#00b97f';
  const linkColor = '#1e90ff';

  const [holders, setHolders] = useState(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchHolders();
  }, []);

  const fetchHolders = async () => {
    try {
      const res = await fetch(
        `https://api.helius.xyz/v0/token-metadata?mint=${MECO_MINT}&api-key=hel1`
      );
      const data = await res.json();
      setHolders(data?.totalAccounts ?? '~');
    } catch {
      setHolders('~');
    }
  };

  const pressAnim = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const openURL = url => Linking.openURL(url).catch(() => {});
  const handleShare = () =>
    Share.share({
      title: 'MECO Wallet',
      message:
        'جرب أول محفظة عربية تدعم رمز MECO 🚀\nhttps://monycoin1.blogspot.com/',
    });

  const StatCard = ({ title, value, icon }) => (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: cardBg, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Text style={[styles.cardTitle, { color: green }]}>
        {icon} {title}
      </Text>
      <Text style={[styles.cardValue, { color: fg }]}>{value}</Text>
    </Animated.View>
  );

  const LinkRow = ({ icon, label, onPress }) => (
    <TouchableOpacity
      style={styles.linkRow}
      onPress={() => {
        pressAnim();
        onPress();
      }}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={[styles.link, { color: linkColor }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: bg }]}>
      {/* HEADER */}
      <Text style={[styles.title, { color: fg }]}>MECO Token</Text>
      <Text style={[styles.description, { color: fg }]}>
        الرمز الرسمي لتطبيق MECO Wallet – مصمم لدعم السيولة وبناء نظام مالي عربي.
      </Text>

      {/* STATS */}
      <StatCard title="السعر الحالي" value="— USDT" icon="💰" />

      <StatCard
        title="عدد المحافظ المالكة"
        value={
          holders === null ? (
            <ActivityIndicator size="small" color={green} />
          ) : (
            holders
          )
        }
        icon="👥"
      />

      <StatCard title="الرسوم المجمعة" value="— SOL" icon="🔁" />

      {/* LINKS */}
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: green, marginBottom: 10 }]}>
          🔗 روابط MECO
        </Text>

        <LinkRow
          icon={<FontAwesome name="telegram" size={20} color={linkColor} />}
          label="قناة Telegram"
          onPress={() => openURL('https://t.me/monycoin1')}
        />

        <LinkRow
          icon={<FontAwesome name="globe" size={20} color={linkColor} />}
          label="الموقع الرسمي"
          onPress={() => openURL('https://monycoin1.blogspot.com/')}
        />

        <LinkRow
          icon={<FontAwesome name="twitter" size={20} color={linkColor} />}
          label="تابعنا على X"
          onPress={() => openURL('https://x.com/MoniCoinMECO')}
        />

        <LinkRow
          icon={<FontAwesome name="facebook" size={20} color={linkColor} />}
          label="فيسبوك"
          onPress={() =>
            openURL('https://www.facebook.com/MonyCoim?mibextid=ZbWKwL')
          }
        />

        <LinkRow
          icon={<Ionicons name="share-social" size={20} color={linkColor} />}
          label="مشاركة التطبيق"
          onPress={handleShare}
        />
      </View>

      {/* FOOTER NOTE */}
      <Text style={[styles.note, { color: fg }]}>
        قريبًا: عرض الرسوم المباشرة، تحليلات السيولة، وتتبع نمو MECO من داخل التطبيق.
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
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    textAlign: 'center',
    opacity: 0.9,
  },
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 6,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
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
    marginTop: 12,
    opacity: 0.8,
  },
});
