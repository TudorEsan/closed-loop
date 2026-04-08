import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { authApi } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { extractErrorMessage } from '@/lib/api';
import { Screen } from '@/components/ui';
import { theme } from '@/lib/theme';

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const { refresh } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.sendOtp(email.trim().toLowerCase());
      setStep('otp');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 4) {
      setError('Code looks too short');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.verifyOtp(email.trim().toLowerCase(), otp.trim());
      await refresh();
      router.replace('/');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            justifyContent: 'center',
          }}
        >
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                ...theme.font.balance,
                color: theme.colors.foreground,
                marginBottom: 8,
              }}
            >
              SoftPOS
            </Text>
            <Text
              style={{
                ...theme.font.body,
                color: theme.colors.mutedForeground,
              }}
            >
              Sign in with your email, we send you a one time code.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xxl,
              padding: 20,
              gap: 16,
              ...theme.shadow.card,
            }}
          >
            {step === 'email' ? (
              <>
                <FieldLabel>Email</FieldLabel>
                <StyledInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
                {error ? <ErrorText>{error}</ErrorText> : null}
                <PrimaryButton
                  label={loading ? null : 'Send code'}
                  loading={loading}
                  onPress={handleSendOtp}
                />
              </>
            ) : (
              <>
                <Text
                  style={{
                    ...theme.font.body,
                    color: theme.colors.mutedForeground,
                  }}
                >
                  We sent a 6 digit code to {email}. Enter it below.
                </Text>
                <FieldLabel>Verification code</FieldLabel>
                <StyledInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {error ? <ErrorText>{error}</ErrorText> : null}
                <PrimaryButton
                  label={loading ? null : 'Verify and continue'}
                  loading={loading}
                  onPress={handleVerifyOtp}
                />
                <Pressable
                  onPress={() => {
                    setStep('email');
                    setOtp('');
                    setError(null);
                  }}
                  style={{ alignItems: 'center', paddingVertical: 8 }}
                >
                  <Text
                    style={{
                      ...theme.font.bodySmall,
                      color: theme.colors.mutedForeground,
                    }}
                  >
                    Change email
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        ...theme.font.bodySmall,
        color: theme.colors.mutedForeground,
        fontWeight: '600',
      }}
    >
      {children}
    </Text>
  );
}

function StyledInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={theme.colors.mutedForeground}
      {...props}
      style={{
        backgroundColor: theme.colors.surfaceSoft,
        borderRadius: theme.radius.md,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 16,
        color: theme.colors.foreground,
      }}
    />
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <Text
      style={{
        ...theme.font.bodySmall,
        color: theme.colors.danger,
      }}
    >
      {children}
    </Text>
  );
}

function PrimaryButton({
  label,
  loading,
  onPress,
}: {
  label: string | null;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius.pill,
        paddingVertical: 16,
        alignItems: 'center',
        opacity: loading ? 0.7 : pressed ? 0.9 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.heroText} />
      ) : (
        <Text
          style={{
            ...theme.font.button,
            color: theme.colors.heroText,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
