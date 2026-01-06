import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Image, ScrollView, ActivityIndicator, Modal,
  FlatList, RefreshControl
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { fetchQuoteViaRest, executeSwapViaRest } from '../services/jupiterService';

const RPC = 'https://api.mainnet-beta.solana.com';
const MECO_ADDRESS = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';
const MECO_LOGO = 'https://monycoin1.blogspot.com/favicon.ico';
const TOKENS_API_URL = 'https://token.jup.ag/all';

export default function SwapScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  const bg = isDark ? '#121212' : '#F9F9F9';
  const fg = isDark ? '#FFF' : '#111';
  const selBg = isDark ? '#1E1E1E' : '#EEEEEE';
  const selActiveBg = primaryColor;

  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selecting, setSelecting] = useState('from');
  const [amount, setAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expectedAmount, setExpectedAmount] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [searchText, setSearchText] = useState('');

  // تحميل العملات من endpoint الجديد
  useEffect(() => { loadTokens(); }, []);

  useEffect(() => {
    if (fromToken && toToken && parseFloat(amount) > 0) updateExpectedAmount();
    else { setExpectedAmount(null); setQuoteError(null); }
  }, [fromToken, toToken, amount]);

  const loadTokens = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(TOKENS_API_URL);
      if (!res.ok) throw new Error('Failed to fetch tokens list');
      const data = await res.json();
      let list = Array.isArray(data) ? data : data.tokens || [];

      // إضافة MonyCoin/MECO دائمًا
      if (!list.find(t => t.address === MECO_ADDRESS)) {
        list.push({
          address: MECO_ADDRESS,
          symbol: 'MECO',
          name: 'MonyCoin',
          logoURI: MECO_LOGO,
          decimals: 6
        });
      }

      setTokens(list);
      setFilteredTokens(list);
    } catch (err) {
      console.error('Token load error:', err.message);
      Alert.alert('⚠️', 'تعذر جلب العملات من Jupiter: ' + err.message);
      // fallback آمن: MonyCoin فقط
      setTokens([{
        address: MECO_ADDRESS,
        symbol: 'MECO',
        name: 'MonyCoin',
        logoURI: MECO_LOGO,
        decimals: 6
      }]);
      setFilteredTokens([{
        address: MECO_ADDRESS,
        symbol: 'MECO',
        name: 'MonyCoin',
        logoURI: MECO_LOGO,
        decimals: 6
      }]);
    } finally {
      setRefreshing(false);
    }
  };

  const getTokenByAddress = addr => tokens.find(t => t.address === addr);
  const getTokenName = address => { const t = getTokenByAddress(address); return t ? `${t.name} (${t.symbol})` : 'Unknown'; };

  const openSelector = target => { setSelecting(target); setSearchText(''); setFilteredTokens(tokens); setModalVisible(true); };
  const selectToken = address => { selecting === 'from' ? setFromToken(address) : setToToken(address); setModalVisible(false); };
  const swapTokens = () => { [fromToken, toToken] = [toToken, fromToken]; setExpectedAmount(null); setQuoteError(null); setAmount(''); };

  const updateExpectedAmount = async () => {
    try {
      setQuoteLoading(true); setQuoteError(null);
      const quote = await fetchQuoteViaRest(fromToken, toToken, parseFloat(amount));
      if (!quote?.outAmount) { setExpectedAmount(null); setQuoteError(t('no_valid_route') || 'No valid route'); return; }
      const decimals = quote.outToken?.decimals ?? 6;
      setExpectedAmount(quote.outAmount / Math.pow(10, decimals));
    } catch (err) { setExpectedAmount(null); setQuoteError(err.message || t('no_valid_route')); }
    finally { setQuoteLoading(false); }
  };

  const signAndSend = async txBuffer => {
    const web3 = await import('@solana/web3.js');
    const secret = await SecureStore.getItemAsync('wallet_private_key');
    if (!secret) throw new Error('Private key not found');
    const parsedKey = Uint8Array.from(JSON.parse(secret));
    const keypair = web3.Keypair.fromSecretKey(parsedKey);
    const connection = new web3.Connection(RPC);
    const tx = web3.Transaction.from(txBuffer);
    tx.partialSign(keypair);
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  };

  const handleSwap = async () => {
    try {
      if (!fromToken || !toToken || !amount) return Alert.alert(t('error'), t('fill_fields'));
      if (fromToken === toToken) return Alert.alert(t('error'), t('same_currency_error'));
      if (parseFloat(amount) <= 0) return Alert.alert(t('error'), t('amount_must_be_positive'));
      if (!expectedAmount) return Alert.alert(t('error'), t('no_valid_route'));

      setLoading(true);
      const quote = await fetchQuoteViaRest(fromToken, toToken, parseFloat(amount));
      const pubKey = await SecureStore.getItemAsync('wallet_public_key');
      const { success, txid, error } = await executeSwapViaRest(quote, pubKey, signAndSend);
      if (!success) throw new Error(error || 'Swap failed');

      Alert.alert('✅ Swap Successful', `TX: ${txid}`);
      setAmount(''); setExpectedAmount(null);
    } catch (err) { Alert.alert(t('error'), err.message || t('swap_failed')); }
    finally { setLoading(false); }
  };

  const filterTokens = text => { setSearchText(text); setFilteredTokens(tokens.filter(t => t.symbol.toLowerCase().includes(text.toLowerCase()) || t.name.toLowerCase().includes(text.toLowerCase()))); };

  const renderSelector = () => (
    <Modal visible={modalVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.listContainer, { backgroundColor: bg }]}>
          <Text style={[styles.selectorTitle, { color: fg }]}>{selecting === 'from' ? t('from') : t('to_currency')}</Text>
          <TextInput placeholder={t('search')} placeholderTextColor="#999" style={[styles.searchInput, { color: fg, borderColor: primaryColor }]} value={searchText} onChangeText={filterTokens} />
          <FlatList
            data={filteredTokens}
            keyExtractor={(item,i)=>item.address || `token-${i}`}
            renderItem={({item})=>(
              <TouchableOpacity style={styles.selectorItem} onPress={()=>selectToken(item.address)}>
                <Image source={{ uri:item.logoURI || MECO_LOGO }} style={styles.selectorIcon}/>
                <Text style={[styles.selectorText,{color:fg}]}>{item.name} ({item.symbol})</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity onPress={()=>setModalVisible(false)} style={styles.cancelBtn}>
            <Text style={{color:fg,textAlign:'center'}}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={{backgroundColor:bg,flex:1}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadTokens}/>} contentContainerStyle={styles.container}>
      {loading && <ActivityIndicator size="small" color={selActiveBg} style={{margin:10}} />}
      <View style={styles.row}>
        <TouchableOpacity style={[styles.box,{backgroundColor:selBg,flex:1}]} onPress={()=>openSelector('from')}>
          {fromToken ? (
            <View style={styles.tokenRow}>
              <Image source={{uri:getTokenByAddress(fromToken)?.logoURI || MECO_LOGO}} style={styles.tokenIcon}/>
              <Text style={[styles.tokenText,{color:fg}]}>{getTokenName(fromToken)}</Text>
            </View>
          ) : (<Text style={{color:fg,fontWeight:'bold'}}>{t('select_token')}</Text>)}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.swapButtonBase,{shadowColor:primaryColor}]} onPress={swapTokens} disabled={!fromToken || !toToken}>
          <Ionicons name="swap-horizontal" size={28} color={!fromToken || !toToken ? '#999':selActiveBg}/>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.box,{backgroundColor:selBg,flex:1}]} onPress={()=>openSelector('to')}>
          {toToken ? (
            <View style={styles.tokenRow}>
              <Image source={{uri:getTokenByAddress(toToken)?.logoURI || MECO_LOGO}} style={styles.tokenIcon}/>
              <Text style={[styles.tokenText,{color:fg}]}>{getTokenName(toToken)}</Text>
            </View>
          ) : (<Text style={{color:fg,fontWeight:'bold'}}>{t('select_token')}</Text>)}
        </TouchableOpacity>
      </View>

      <TextInput placeholder={t('enter_amount')} placeholderTextColor="#999" keyboardType="numeric" style={[styles.input,{color:fg,borderColor:selActiveBg}]} value={amount} onChangeText={setAmount}/>

      {quoteLoading ? <ActivityIndicator size="small" color={selActiveBg}/> :
        quoteError ? <Text style={{color:'red',fontSize:14,marginBottom:10}}>{quoteError}</Text> :
        expectedAmount !== null ? <Text style={{color:fg,fontSize:14,marginBottom:10}}>{t('expected_output')}: {expectedAmount.toFixed(6)}</Text> : null}

      <TouchableOpacity style={[styles.button,{backgroundColor:(!fromToken || !toToken || !amount || !expectedAmount)?'#999':selActiveBg}]} onPress={handleSwap} disabled={!fromToken || !toToken || !amount || !expectedAmount}>
        <Text style={styles.buttonText}>{t('execute_swap')}</Text>
      </TouchableOpacity>

      {renderSelector()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{padding:20,paddingBottom:40},
  box:{padding:14,borderRadius:8,marginBottom:12},
  input:{borderWidth:1,padding:14,borderRadius:8,marginBottom:12,fontSize:16},
  button:{padding:16,borderRadius:8,alignItems:'center',marginTop:10},
  buttonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  modalOverlay:{flex:1,backgroundColor:'#00000080',justifyContent:'center',alignItems:'center'},
  listContainer:{width:'80%',maxHeight:'70%',borderRadius:12,padding:12},
  selectorTitle:{fontSize:18,fontWeight:'bold',marginBottom:10},
  searchInput:{borderWidth:1,borderRadius:8,padding:10,marginBottom:10},
  selectorItem:{flexDirection:'row',alignItems:'center',paddingVertical:8},
  selectorIcon:{width:32,height:32,borderRadius:16,marginRight:12},
  selectorText:{fontSize:16,fontWeight:'500'},
  cancelBtn:{padding:10,marginTop:10},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  tokenRow:{flexDirection:'row',alignItems:'center'},
  tokenIcon:{width:28,height:28,borderRadius:14,marginRight:8},
  tokenText:{fontSize:15,fontWeight:'500'},
  swapButtonBase:{backgroundColor:'#222',borderRadius:24,width:48,height:48,justifyContent:'center',alignItems:'center',marginHorizontal:8,shadowOffset:{width:0,height:0},shadowOpacity:0.9,shadowRadius:8,elevation:6},
});
