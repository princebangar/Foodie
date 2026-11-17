// Web: modules/Food/components/user/LoginRequiredModal.jsx — the guest "LOGIN REQUIRED" popup (opened by the
// 'show-login-required' window event in UserLayout). Same texts, colours (light and dark), Warli border and navigation.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { LogOut, X } from 'lucide-react-native';
import { useNavigate } from '@/lib/router';
import { Text } from '@/native/ui';
import { alpha, useTheme } from '@/theme';

// Chain of traditional Warli figures holding hands (web: svg 100% x 45, viewBox 0 0 350 45, opacity .12 / dark .20)
function WarliBorder({ dark }) {
  return (
    <Svg width="100%" height={45} viewBox="0 0 350 45" preserveAspectRatio="none" style={{ opacity: dark ? 0.2 : 0.12 }}>
      {Array.from({ length: 9 }).map((_, index) => {
        const x = 25 + index * 37;
        return (
          <G key={index} stroke="#DC2626" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={x} cy={11} r={3.5} fill="#DC2626" />
            <Path d={`M ${x - 5} 17 L ${x + 5} 17 L ${x} 23 Z`} fill="#DC2626" />
            <Path d={`M ${x - 5} 29 L ${x + 5} 29 L ${x} 23 Z`} fill="#DC2626" />
            {index > 0 ? <Path d={`M ${x - 5} 19 Q ${x - 18.5} 13 ${x - 32} 19`} /> : null}
            <Path d={`M ${x - 2} 29 L ${x - 5} 37`} />
            <Path d={`M ${x + 2} 29 L ${x + 5} 37`} />
          </G>
        );
      })}
    </Svg>
  );
}

export default function LoginRequiredModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const t = useTheme();
  const d = t.dark;
  const [mounted, setMounted] = useState(isOpen);
  const anim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) setMounted(true);
    Animated.timing(anim, { toValue: isOpen ? 1 : 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !isOpen) setMounted(false);
    });
  }, [isOpen, anim]);

  if (!isOpen && !mounted) return null;

  const handleLoginClick = () => {
    // Navigate directly to the user login page to trigger instant transition
    navigate('/user/auth/login');
  };

  const border = d ? '#382D24' : '#EBE1CD';

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => onClose?.()}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: alpha('#000000', 0.6) }]} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            { backgroundColor: d ? '#1C1613' : '#FCF9F2', borderColor: border },
            { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] },
          ]}
        >
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close modal"
            hitSlop={6}
            style={({ pressed }) => [styles.close, pressed && { backgroundColor: alpha(border, 0.4) }]}
          >
            <X size={20} color={d ? '#EAE0D5' : '#DC2626'} />
          </Pressable>

          <View pointerEvents="none" style={styles.topLine} />

          <View style={[styles.iconBox, { backgroundColor: alpha(border, 0.3), borderColor: border }]}>
            <LogOut size={28} color={d ? '#E8AF9D' : '#DC2626'} />
          </View>

          <Text style={[styles.title, { color: d ? '#F3D7C9' : '#DC2626' }]}>LOGIN REQUIRED</Text>

          <Text style={[styles.caption, { color: d ? '#C5B39E' : '#615446' }]}>Please login to continue your delicious journey</Text>

          <Pressable
            onPress={handleLoginClick}
            style={({ pressed }) => [styles.loginBtn, pressed && { backgroundColor: '#991B1B', transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.loginText}>LOGIN / SIGN UP</Text>
          </Pressable>

          <View pointerEvents="none" style={{ width: '100%', marginTop: 8 }}>
            <WarliBorder dark={d} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },
  close: { position: 'absolute', top: 16, right: 16, padding: 6, borderRadius: 9999, zIndex: 2 },
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#DC2626', opacity: 0.3 },
  iconBox: {
    marginTop: 24,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  // text-xl font-black tracking-wider uppercase font-serif
  title: { fontSize: 20, lineHeight: 28, fontWeight: '900', letterSpacing: 1, marginBottom: 12, fontFamily: 'serif', textAlign: 'center' },
  caption: { fontSize: 14, lineHeight: 22.75, fontWeight: '500', maxWidth: 280, marginBottom: 24, textAlign: 'center' },
  loginBtn: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 9999,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  loginText: { color: '#ffffff', fontWeight: '700', letterSpacing: 1.4, fontSize: 14, lineHeight: 20 },
});
