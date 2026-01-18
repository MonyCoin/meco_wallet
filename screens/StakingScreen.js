import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Animated,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getTokenAccounts } from '../services/heliusService';
import * as SecureStore from 'expo-secure-store';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');

// بيانات Staking افتراضية (للتطوير)
const STAKING_CONFIG = {
  APR: 18.5, // Annual Percentage Rate
  MIN_STAKE: 100, // الحد الأدنى للـ Staking
  MAX_STAKE: 1000000, // الحد الأقصى
  REWARD_INTERVAL: 'daily', // توزيع المكافآت يومي
  UNSTAKE_PERIOD: 3, // أيام الانتظار للـ Unstake
  STAKING_CONTRACT: 'StakeContractAddressHere' // سيتم تحديثه لاحقاً
};

const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';

export default function StakingScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  
  // ألوان متناسقة مع الثيم
  const colors = {
    background: isDark ? '#0A0A0F' : '#F8FAFD',
    card: isDark ? '#1A1A2E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2A2A3E' : '#E5E7EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  };

  const [balance, setBalance] = useState(0);
  const [stakedAmount, setStakedAmount] = useState(0);
  const [rewards, setRewards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stakeModalVisible, setStakeModalVisible] = useState(false);
  const [unstakeModalVisible, setUnstakeModalVisible] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    // تأثيرات دخول الشاشة
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    loadStakingData();
    
    // محاكاة تحديث المكافآت كل دقيقة
    const interval = setInterval(() => {
      updateRewards();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadStakingData = async () => {
    try {
      setLoading(true);
      
      // 1. جلب رصيد MECO
      const pubKey = await SecureStore.getItemAsync('wallet_public_key');
      if (pubKey) {
        const tokens = await getTokenAccounts(pubKey);
        const mecoToken = tokens.find(t => t.mint === MECO_MINT);
        setBalance(mecoToken?.amount || 0);
      }
      
      // 2. جلب بيانات Staking من العقد الذكي (محاكاة الآن)
      // TODO: الاتصال بالعقد الذكي الحقيقي
      const mockStaked = 500; // محاكاة
      const mockRewards = 25.5; // محاكاة
      
      setStakedAmount(mockStaked);
      setRewards(mockRewards);
      
    } catch (error) {
      console.error('Error loading staking data:', error);
      Alert.alert('خطأ', 'فشل تحميل بيانات الـ Staking');
    } finally {
      setLoading(false);
    }
  };

  const updateRewards = () => {
    // محاكاة حساب المكافآت
    const dailyReward = (stakedAmount * STAKING_CONFIG.APR) / 365 / 100;
    const hourlyReward = dailyReward / 24;
    setRewards(prev => prev + hourlyReward);
  };

  const calculateEstimatedRewards = (amount) => {
    const daily = (amount * STAKING_CONFIG.APR) / 365 / 100;
    const monthly = daily * 30;
    const yearly = daily * 365;
    
    return {
      daily: daily.toFixed(4),
      monthly: monthly.toFixed(2),
      yearly: yearly.toFixed(2)
    };
  };

  const handleStake = async () => {
    try {
      const amount = parseFloat(stakeAmount);
      
      if (!amount || amount <= 0) {
        Alert.alert('خطأ', 'الرجاء إدخال مقدار صحيح');
        return;
      }
      
      if (amount < STAKING_CONFIG.MIN_STAKE) {
        Alert.alert('خطأ', `الحد الأدنى للـ Staking هو ${STAKING_CONFIG.MIN_STAKE} MECO`);
        return;
      }
      
      if (amount > balance) {
        Alert.alert('خطأ', 'رصيدك غير كافي');
        return;
      }
      
      // TODO: تنفيذ Staking فعلي على العقد الذكي
      Alert.alert(
        'تأكيد Staking',
        `هل تريد عمل Staking لـ ${amount} MECO بمعدل عائد ${STAKING_CONFIG.APR}% سنوي؟`,
        [
          { text: 'إلغاء', style: 'cancel' },
          { 
            text: 'تأكيد', 
            onPress: async () => {
              // محاكاة Staking ناجح
              setStakedAmount(prev => prev + amount);
              setBalance(prev => prev - amount);
              setStakeModalVisible(false);
              setStakeAmount('');
              
              Alert.alert('نجاح', `تم عمل Staking لـ ${amount} MECO بنجاح!`);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Staking error:', error);
      Alert.alert('خطأ', 'فشل عملية الـ Staking');
    }
  };

  const handleUnstake = async () => {
    try {
      const amount = parseFloat(unstakeAmount);
      
      if (!amount || amount <= 0) {
        Alert.alert('خطأ', 'الرجاء إدخال مقدار صحيح');
        return;
      }
      
      if (amount > stakedAmount) {
        Alert.alert('خطأ', 'المقدار المطلوب أكبر من المقدار الموجود في Staking');
        return;
      }
      
      // TODO: تنفيذ Unstake فعلي من العقد الذكي
      Alert.alert(
        'تأكيد Unstake',
        `هل تريد إلغاء Staking لـ ${amount} MECO؟\n\nملاحظة: سيتم تحويل المبلغ خلال ${STAKING_CONFIG.UNSTAKE_PERIOD} أيام`,
        [
          { text: 'إلغاء', style: 'cancel' },
          { 
            text: 'تأكيد', 
            onPress: async () => {
              // محاكاة Unstake ناجح
              setStakedAmount(prev => prev - amount);
              setBalance(prev => prev + amount);
              setUnstakeModalVisible(false);
              setUnstakeAmount('');
              
              Alert.alert(
                'نجاح', 
                `تم طلب إلغاء Staking لـ ${amount} MECO\nسيتم استلامه خلال ${STAKING_CONFIG.UNSTAKE_PERIOD} أيام`
              );
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Unstake error:', error);
      Alert.alert('خطأ', 'فشل عملية الـ Unstake');
    }
  };

  const handleClaimRewards = async () => {
    if (rewards <= 0) {
      Alert.alert('تنبيه', 'لا توجد مكافآت متاحة للسحب');
      return;
    }
    
    // TODO: تنفيذ سحب المكافآت من العقد الذكي
    Alert.alert(
      'سحب المكافآت',
      `هل تريد سحب ${rewards.toFixed(4)} MECO من مكافآت الـ Staking؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'سحب', 
          onPress: async () => {
            // محاكاة سحب ناجح
            const claimed = rewards;
            setBalance(prev => prev + claimed);
            setRewards(0);
            
            Alert.alert('نجاح', `تم سحب ${claimed.toFixed(4)} MECO بنجاح!`);
          }
        }
      ]
    );
  };

  const handleMaxStake = () => {
    setStakeAmount(balance.toString());
  };

  const handleMaxUnstake = () => {
    setUnstakeAmount(stakedAmount.toString());
  };

  const renderStakeModal = () => (
    <Modal visible={stakeModalVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Stake MECO
            </Text>
            <TouchableOpacity onPress={() => setStakeModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
            أدخل مقدار MECO الذي تريد عمل Staking له
          </Text>
          
          <View style={[styles.amountInputContainer, { backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={stakeAmount}
              onChangeText={setStakeAmount}
            />
            <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
              MECO
            </Text>
            <TouchableOpacity onPress={handleMaxStake}>
              <Text style={[styles.maxButton, { color: primaryColor }]}>
                أقصى
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
            الرصيد المتاح: {balance.toFixed(2)} MECO
          </Text>
          
          {stakeAmount && parseFloat(stakeAmount) > 0 && (
            <View style={styles.rewardsEstimation}>
              <Text style={[styles.estimationTitle, { color: colors.text }]}>
                📊 تقدير المكافآت:
              </Text>
              <View style={styles.estimationRow}>
                <Text style={[styles.estimationLabel, { color: colors.textSecondary }]}>
                  يومياً:
                </Text>
                <Text style={[styles.estimationValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(parseFloat(stakeAmount)).daily} MECO
                </Text>
              </View>
              <View style={styles.estimationRow}>
                <Text style={[styles.estimationLabel, { color: colors.textSecondary }]}>
                  شهرياً:
                </Text>
                <Text style={[styles.estimationValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(parseFloat(stakeAmount)).monthly} MECO
                </Text>
              </View>
              <View style={styles.estimationRow}>
                <Text style={[styles.estimationLabel, { color: colors.textSecondary }]}>
                  سنوياً:
                </Text>
                <Text style={[styles.estimationValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(parseFloat(stakeAmount)).yearly} MECO
                </Text>
              </View>
            </View>
          )}
          
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: primaryColor }]}
            onPress={handleStake}
            disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
          >
            <Text style={styles.modalButtonText}>
              تأكيد الـ Stake
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderUnstakeModal = () => (
    <Modal visible={unstakeModalVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Unstake MECO
            </Text>
            <TouchableOpacity onPress={() => setUnstakeModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
            أدخل مقدار MECO الذي تريد إلغاء Staking له
          </Text>
          
          <View style={[styles.amountInputContainer, { backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={unstakeAmount}
              onChangeText={setUnstakeAmount}
            />
            <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
              MECO
            </Text>
            <TouchableOpacity onPress={handleMaxUnstake}>
              <Text style={[styles.maxButton, { color: primaryColor }]}>
                أقصى
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
            المقدار في Staking: {stakedAmount.toFixed(2)} MECO
          </Text>
          
          <View style={styles.unstakeWarning}>
            <Ionicons name="warning-outline" size={20} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              ملاحظة: سيتم تحويل المبلغ خلال {STAKING_CONFIG.UNSTAKE_PERIOD} أيام
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: colors.error }]}
            onPress={handleUnstake}
            disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0}
          >
            <Text style={styles.modalButtonText}>
              تأكيد الـ Unstake
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          جاري تحميل بيانات الـ Staking...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.container, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* الهيدر */}
          <View style={styles.header}>
            <Ionicons name="trending-up" size={32} color={primaryColor} />
            <Text style={[styles.title, { color: colors.text }]}>
              Staking MECO
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              احصل على دخل سلبي ودعم شبكة MECO
            </Text>
          </View>

          {/* بطاقة APR الرئيسية */}
          <View style={[styles.aprCard, { backgroundColor: primaryColor }]}>
            <Text style={styles.aprLabel}>معدل العائد السنوي</Text>
            <Text style={styles.aprValue}>{STAKING_CONFIG.APR}%</Text>
            <Text style={styles.aprDescription}>أعلى من معظم البنوك التقليدية</Text>
          </View>

          {/* بطاقة رصيد Staking */}
          <View style={[styles.stakingCard, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                محفظة الـ Staking
              </Text>
              <TouchableOpacity onPress={loadStakingData}>
                <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  المقدار في Staking
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {stakedAmount.toFixed(2)} MECO
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  المكافآت المتراكمة
                </Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {rewards.toFixed(4)} MECO
                </Text>
              </View>
            </View>
            
            <View style={styles.balanceInfo}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                رصيد MECO المتاح:
              </Text>
              <Text style={[styles.balanceValue, { color: colors.text }]}>
                {balance.toFixed(2)} MECO
              </Text>
            </View>
          </View>

          {/* أزرار الإجراءات */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: primaryColor }]}
              onPress={() => setStakeModalVisible(true)}
              disabled={balance <= 0}
            >
              <Ionicons name="arrow-up-circle" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Stake</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setUnstakeModalVisible(true)}
              disabled={stakedAmount <= 0}
            >
              <Ionicons name="arrow-down-circle" size={24} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Unstake</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success }]}
              onPress={handleClaimRewards}
              disabled={rewards <= 0}
            >
              <Ionicons name="gift" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>سحب المكافآت</Text>
            </TouchableOpacity>
          </View>

          {/* معلومات Staking */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle-outline" size={20} color={primaryColor} />
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                كيف يعمل Staking؟
              </Text>
            </View>
            
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  تحتفظ برصيد MECO وتدعم الشبكة
                </Text>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  تحصل على مكافآت يومية بنسبة {STAKING_CONFIG.APR}% سنوي
                </Text>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  يمكنك إلغاء الـ Staking في أي وقت
                </Text>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  لا توجد رسوم على الـ Staking
                </Text>
              </View>
            </View>
          </View>

          {/* كالمكافآت المقدرة */}
          <View style={[styles.rewardsCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.rewardsTitle, { color: colors.text }]}>
              📈 تقدير المكافآت
            </Text>
            
            <View style={styles.rewardsGrid}>
              <View style={styles.rewardItem}>
                <Text style={[styles.rewardValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(stakedAmount).daily}
                </Text>
                <Text style={[styles.rewardLabel, { color: colors.textSecondary }]}>
                  MECO يومياً
                </Text>
              </View>
              
              <View style={styles.rewardItem}>
                <Text style={[styles.rewardValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(stakedAmount).monthly}
                </Text>
                <Text style={[styles.rewardLabel, { color: colors.textSecondary }]}>
                  MECO شهرياً
                </Text>
              </View>
              
              <View style={styles.rewardItem}>
                <Text style={[styles.rewardValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(stakedAmount).yearly}
                </Text>
                <Text style={[styles.rewardLabel, { color: colors.textSecondary }]}>
                  MECO سنوياً
                </Text>
              </View>
            </View>
          </View>

          {/* ملاحظات هامة */}
          <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.warning + '30' }]}>
            <View style={styles.notesHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
              <Text style={[styles.notesTitle, { color: colors.text }]}>
                ملاحظات هامة
              </Text>
            </View>
            
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              • المكافآت توزع يومياً تلقائياً
              {'\n'}• الحد الأدنى للـ Staking: {STAKING_CONFIG.MIN_STAKE} MECO
              {'\n'}• مدة الانتظار للـ Unstake: {STAKING_CONFIG.UNSTAKE_PERIOD} أيام
              {'\n'}• الأسعار قابلة للتغيير حسب ظروف الشبكة
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* المودالات */}
      {renderStakeModal()}
      {renderUnstakeModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  aprCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  aprLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginBottom: 4,
  },
  aprValue: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 8,
  },
  aprDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  stakingCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  balanceInfo: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  balanceLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  infoCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 10,
    flex: 1,
  },
  rewardsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  rewardsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  rewardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardItem: {
    alignItems: 'center',
    flex: 1,
  },
  rewardValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  rewardLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
  notesCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    paddingVertical: 8,
  },
  currencyLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 14,
    marginBottom: 20,
  },
  rewardsEstimation: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  estimationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  estimationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  estimationLabel: {
    fontSize: 13,
  },
  estimationValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  unstakeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
