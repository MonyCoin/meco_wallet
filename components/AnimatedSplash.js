// components/AnimatedSplash.js
// شاشة فتح متحركة: تتسلّم من شاشة الفتح الأصلية بنفس الحجم والموضع،
// ثم تتلاشى حين يجهز التطبيق (بعد مدة عرض دنيا قصيرة).
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

const BG          = '#000000';
const MIN_SHOW_MS = 1000;                       // أقل مدة عرض
const EXIT_MS     = 280;                        // مدة التلاشي
const GLYPH_W     = 140;                        // يطابق شاشة الفتح الأصلية: imageWidth 200 × 70%
const VB          = { x: 326, y: 190, w: 368, h: 328 };   // حدود رسم المحفظة (نفس assets/logo.png)
const GLYPH_H     = (GLYPH_W * VB.h) / VB.w;
const GLOW        = 360;

function Glyph() {
  return (
    <Svg width={GLYPH_W} height={GLYPH_H} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}>
      <Defs>
        <LinearGradient id="msClasp" x1="0.25" y1="0" x2="0.85" y2="1">
          <Stop offset="0"    stopColor="#F7912C" />
          <Stop offset="0.38" stopColor="#F46337" />
          <Stop offset="0.55" stopColor="#3FA0E0" />
          <Stop offset="1"    stopColor="#2FB8F2" />
        </LinearGradient>
      </Defs>
      <Path d="M352 252 Q350 238 368 234 L571 201 Q604 196 609 226 L613 252 Z" fill="#FFFFFF" />
      <Rect x="333" y="253" width="350" height="258" rx="44" fill="#FFFFFF" />
      <Path d="M566 333 H688 V433 H566 Q516 433 516 383 Q516 333 566 333 Z" fill="url(#msClasp)" />
      <Path d="M688 333 H566 Q516 333 516 383 Q516 433 566 433 H688" fill="none" stroke="#0A1A38" strokeWidth="9" strokeLinejoin="round" />
      <Rect x="539" y="356" width="54" height="54" rx="27" fill="#F7912C" />
      <Rect x="553" y="370" width="26" height="26" rx="13" fill="#FFFFFF" />
    </Svg>
  );
}

function Glow() {
  return (
    <Svg width={GLOW} height={GLOW}>
      <Defs>
        <RadialGradient id="msGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0"   stopColor="#1D6FF2" stopOpacity="0.55" />
          <Stop offset="0.7" stopColor="#1D6FF2" stopOpacity="0.11" />
          <Stop offset="1"   stopColor="#1D6FF2" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={GLOW} height={GLOW} fill="url(#msGlow)" />
    </Svg>
  );
}

export default function AnimatedSplash({ ready, onShown, onDone }) {
  const mountedAt = useRef(Date.now());
  const shown     = useRef(false);
  const exiting   = useRef(false);

  const glow  = useRef(new Animated.Value(0)).current;      // ظهور التوهج
  const pulse = useRef(new Animated.Value(0)).current;      // نبض هادئ 0..1
  const exit  = useRef(new Animated.Value(0)).current;      // الخروج 0..1
  const dots  = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current;

  const notifyShown = () => {
    if (shown.current) return;
    shown.current = true;
    if (onShown) onShown();
  };

  // أول ظهور: نخبر الأب ليُخفي شاشة الفتح الأصلية (مع مهلة احتياطية)
  useEffect(() => {
    const t = setTimeout(notifyShown, 400);
    return () => clearTimeout(t);
  }, []);

  // الحركة: توهج يظهر + نبض هادئ + نقاط تحميل
  useEffect(() => {
    Animated.timing(glow, {
      toValue: 1, duration: 700, delay: 150,
      easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();

    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    breathe.start();

    const dotLoops = dots.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(v, { toValue: 1,    duration: 320, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.25, duration: 320, useNativeDriver: true }),
      Animated.delay((2 - i) * 160),
    ])));
    dotLoops.forEach((l) => l.start());

    return () => { breathe.stop(); dotLoops.forEach((l) => l.stop()); };
  }, []);

  // الخروج: بعد جاهزية التطبيق وبعد المدة الدنيا
  useEffect(() => {
    if (!ready || exiting.current) return undefined;
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - mountedAt.current));
    const timer = setTimeout(() => {
      exiting.current = true;
      Animated.timing(exit, {
        toValue: 1, duration: EXIT_MS,
        easing: Easing.in(Easing.quad), useNativeDriver: true,
      }).start(() => { if (onDone) onDone(); });
    }, wait);
    return () => clearTimeout(timer);
  }, [ready]);

  const glyphScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const glowScale  = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const exitScale  = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const rootAlpha  = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View onLayout={notifyShown} style={[S.root, { opacity: rootAlpha }]}>
      <Animated.View style={{ width: GLYPH_W, height: GLYPH_H, transform: [{ scale: exitScale }] }}>
        <Animated.View style={[S.glow, { opacity: glow, transform: [{ scale: glowScale }] }]}>
          <Glow />
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: glyphScale }] }}>
          <Glyph />
        </Animated.View>
      </Animated.View>
      <View style={S.dotsRow}>
        {dots.map((v, i) => <Animated.View key={i} style={[S.dot, { opacity: v }]} />)}
      </View>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    elevation: 10000,
  },
  glow: {
    position: 'absolute',
    left: (GLYPH_W - GLOW) / 2,
    top:  (GLYPH_H - GLOW) / 2,
    width: GLOW,
    height: GLOW,
  },
  dotsRow: {
    position: 'absolute',
    left: 0, right: 0,
    top: '50%',
    marginTop: GLYPH_H / 2 + 44,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6', marginHorizontal: 4 },
});
