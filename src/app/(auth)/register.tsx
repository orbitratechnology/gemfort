import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/brand-mark';
import { StoryChapter } from '@/components/brand/story-chapter';
import { Button } from '@/components/ui/button';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { Brand } from '@/constants/brand-story';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import { registerUser } from '@/lib/firebase/auth-service';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';
import type { UserRole } from '@/types';

const roles: { id: UserRole; label: string }[] = [
  { id: 'normal_user', label: 'Buyer / Trader' },
  { id: 'verified_seller', label: 'Seller' },
  { id: 'verified_provider', label: 'Service Provider' },
];

export default function RegisterScreen() {
  const { colors } = useAppTheme();
  const ts = useThemeStyles();
  const toast = useToast();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [roleIntent, setRoleIntent] = useState<UserRole>('normal_user');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!displayName || !email || !phone || !password) {
      toast.error('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const { phone: verifiedPhone } = await registerUser({
        email,
        password,
        displayName,
        phone,
        roleIntent,
      });
      router.replace({ pathname: '/(auth)/verify-otp', params: { phone: verifiedPhone } });
    } catch (e) {
      toast.error(friendlyError(e, 'Could not create account. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ThemedScrollView contentContainerStyle={styles.container}>
          <BrandMark size="md" />
          <StoryChapter
            title="Create your account"
            body={`${Brand.subtagline} Join the GemFort community to track stones and connect with traders.`}
          />
          <Input label="Full Name" value={displayName} onChangeText={setDisplayName} />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+94 77X XXX XXXX"
          />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Text style={[styles.label, ts.textSecondary]}>I am a...</Text>
          <View style={styles.roles}>
            {roles.map((r) => (
              <Pressable
                key={r.id}
                style={[styles.roleChip, ts.chip, roleIntent === r.id && ts.chipActive]}
                onPress={() => setRoleIntent(r.id)}>
                <Text
                  style={[
                    styles.roleText,
                    ts.chipText,
                    roleIntent === r.id && ts.chipTextActive,
                  ]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button title="Create Account" loading={loading} onPress={handleRegister} />
        </ThemedScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.xxl, gap: Spacing.lg },
  label: { ...Typography.label },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleText: { ...Typography.bodySmall },
});
