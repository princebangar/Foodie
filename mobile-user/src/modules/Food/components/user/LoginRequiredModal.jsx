// Web: modules/Food/components/user/LoginRequiredModal.jsx — the guest "login required" popup (opened by the
// 'show-login-required' window event in UserLayout). Same purpose, texts and navigation as the web.
// Prince (18 Nov): redesigned for the app - the web card (cream, serif uppercase title, a logout/exit icon in a beige
// box, a Warli strip under the button) looked off and too tall on the phone. Now a solid card, a login icon in a soft
// red badge, a plain bold title, the red LOGIN / SIGN UP button and a "Not now" text button.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LogIn, X } from 'lucide-react-native';
import { useNavigate } from '@/lib/router';
import { Text } from '@/native/ui';
import { alpha, useTheme } from '@/theme';

const RED = '#DC2626'; // Home's BRAND_RED

export default function LoginRequiredModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const t = useTheme();
  const d = t.dark;
  const [mounted, setMounted] = useState(isOpen);
  const anim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    if (isOpen) setMounted(true);
    Animated.timing(anim, {
      toValue: isOpen ? 1 : 0,
      duration: isOpen ? 200 : 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !isOpen) setMounted(false);
    });
  }, [isOpen, anim]);

  if (!isOpen && !mounted) return null;

  const handleLoginClick = () => {
    onClose?.();
    navigate('/user/auth/login');
  };

  const cardBg = d ? '#1A1A1A' : '#FFFFFF';
  const titleColor = d ? '#F5F5F5' : '#1C1C1C';
  const textColor = d ? '#A3A3A3' : '#6B7280';

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => onClose?.()}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: alpha('#000000', 0.55) }]} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: d ? alpha('#FFFFFF', 0.08) : '#F1F1F1' },
            {
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            hitSlop={10}
            style={({ pressed }) => [styles.close, { backgroundColor: d ? '#262626' : '#F4F4F5' }, pressed && { opacity: 0.7 }]}
          >
            <X size={16} color={d ? '#D4D4D4' : '#52525B'} />
          </Pressable>

          <View style={[styles.badge, { backgroundColor: d ? '#3B1418' : '#FEF2F2', borderColor: d ? '#2A0F12' : '#FFF7F8' }]}>
            <LogIn size={28} color={RED} strokeWidth={2.2} />
          </View>

          <Text style={[styles.title, { color: titleColor }]}>Login required</Text>
          <Text style={[styles.caption, { color: textColor }]}>Please login to continue your delicious journey</Text>

          <Pressable
            onPress={handleLoginClick}
            style={({ pressed }) => [styles.loginBtn, pressed && { backgroundColor: '#B91C1C', transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.loginText}>LOGIN / SIGN UP</Text>
          </Pressable>

          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.laterBtn, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.laterText, { color: textColor }]}>Not now</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 9999,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  caption: { fontSize: 14, lineHeight: 21, fontWeight: '400', textAlign: 'center', maxWidth: 270, marginBottom: 22 },
  loginBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: RED,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  loginText: { color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.8, fontSize: 15, lineHeight: 20 },
  laterBtn: { marginTop: 6, paddingVertical: 10, paddingHorizontal: 16 },
  laterText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
