import { Core } from '@walletconnect/core';
import { Web3Wallet } from '@walletconnect/web3wallet';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

// ✅ مفتاح مشروعك من Reown
const PROJECT_ID = 'adc86bcd79a29a39ea0af19d5eca9ecf'; 

let web3wallet;

export async function initWalletConnect() {
  try {
    // 1. تهيئة النواة
    const core = new Core({
      projectId: PROJECT_ID,
    });

    // 2. إعداد بيانات التطبيق (Metadata)
    const metadata = {
      name: 'Meco Wallet',
      description: 'The First Arab Crypto Wallet',
      url: 'https://monycoin.github.io/meco-token/',
      // ✅ تم تحديث رابط صورة التطبيق الصحيحة
      icons: ['https://raw.githubusercontent.com/MonyCoin/meco_wallet/refs/heads/main/assets/logo.png'],
      redirect: {
        native: 'meco://',
      },
    };

    // 3. إنشاء وتجهيز المحفظة
    web3wallet = await Web3Wallet.init({
      core,
      metadata,
    });

    console.log('✅ WalletConnect Service Initialized');

    // تشغيل المستمعين (Listeners) لاستقبال الطلبات
    setupEventListeners();

    return web3wallet;

  } catch (error) {
    // فشل صامت أو تحذير بسيط حتى لا يزعج المستخدم إذا لم يكن هناك إنترنت
    console.log('⚠️ WalletConnect init warning:', error.message);
  }
}

function setupEventListeners() {
  if (!web3wallet) return;

  // عند استقبال طلب اتصال جديد من موقع خارجي
  web3wallet.on('session_proposal', async (proposal) => {
    const { name, url } = proposal.params.proposer.metadata;
    
    Alert.alert(
      'طلب اتصال 🔗',
      `يرغب موقع "${name}" (${url}) في الاتصال بمحفظتك.`,
      [
        { text: 'رفض', onPress: () => rejectSession(proposal.id), style: 'cancel' },
        { text: 'موافقة', onPress: () => approveSession(proposal.id) }
      ]
    );
  });

  // عند استقبال طلب توقيع معاملة (مستقبلاً)
  web3wallet.on('session_request', async (event) => {
    Alert.alert('تنبيه', 'تم طلب توقيع معاملة (سيتم التفعيل قريباً)');
  });
}

// دالة الموافقة على الاتصال
export async function approveSession(proposalId) {
  try {
    const pubKey = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKey) return;

    // تعريف شبكة سولانا (Mainnet)
    const namespace = {
      methods: ['solana_signTransaction', 'solana_signMessage'],
      chains: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'], // Solana Mainnet Chain ID
      events: [],
      accounts: [`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${pubKey}`]
    };

    await web3wallet.approveSession({
      id: proposalId,
      namespaces: {
        solana: namespace
      }
    });

    Alert.alert('نجاح', 'تم الاتصال بالموقع بنجاح ✅');
  } catch (error) {
    console.log('Approve Error:', error);
  }
}

// دالة رفض الاتصال
export async function rejectSession(proposalId) {
  try {
    await web3wallet.rejectSession({
      id: proposalId,
      reason: {
        code: 5000,
        message: 'User rejected.'
      }
    });
  } catch (error) {
    console.log('Reject Error:', error);
  }
}
