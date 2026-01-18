import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const useAppStore = create((set) => ({
  // ====== إعداداتك الأصلية ======
  theme: 'dark', // تم تغيير القيمة من 'light' إلى 'dark'
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),

  language: 'ar',
  setLanguage: (lang) => set({ language: lang }),

  walletName: 'MECO Wallet',
  setWalletName: (name) => set({ walletName: name }),

  primaryColor: '#00b97f',
  setPrimaryColor: (color) => set({ primaryColor: color }),

  // ====== بيانات المحفظة ======
  walletPublicKey: null,
  walletPrivateKey: null,

  loadWallet: async () => {
    try {
      const publicKey = await SecureStore.getItemAsync('wallet_public_key');
      const privateKey = await SecureStore.getItemAsync('wallet_private_key');

      if (!publicKey || !privateKey) {
        return false;
      }

      set({
        walletPublicKey: publicKey,
        walletPrivateKey: privateKey,
      });

      return true;
    } catch (e) {
      console.warn('Wallet info load error:', e.message);
      return false;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('wallet_private_key');
    await SecureStore.deleteItemAsync('wallet_public_key');
    await SecureStore.deleteItemAsync('wallet_mnemonic');
    await SecureStore.deleteItemAsync('wallet_initialized');

    set({
      walletPublicKey: null,
      walletPrivateKey: null,
    });
  },
}));
