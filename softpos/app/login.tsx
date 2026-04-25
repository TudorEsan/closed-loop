import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  FieldError,
  Input,
  InputOTP,
  REGEXP_ONLY_DIGITS,
  Spinner,
  TextField,
  useThemeColor,
} from 'heroui-native';

import { authApi } from '@/lib/auth';
import { useAuthContext } from '@/lib/auth-context';
import { extractErrorMessage } from '@/lib/api';
import { Screen } from '@/components/ui';

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const { setSession } = useAuthContext();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

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
      setCooldown(30);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.sendOtp(email.trim().toLowerCase());
      setCooldown(30);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    if (code.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      const session = await authApi.verifyOtp(email.trim().toLowerCase(), code);
      setSession(session);
      router.replace('/');
    } catch (err) {
      setError(extractErrorMessage(err));
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setStep('email');
    setOtp('');
    setError(null);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-2">
            <Pressable
              onPress={step === 'otp' ? goBack : undefined}
              hitSlop={12}
              className="mb-6 h-10 w-10 items-center justify-center rounded-full"
              style={{ opacity: step === 'otp' ? 1 : 0 }}
            >
              <Ionicons name="arrow-back" size={22} color="#0a0a0a" />
            </Pressable>

            {step === 'email' ? (
              <EmailStep
                email={email}
                setEmail={setEmail}
                loading={loading}
                error={error}
                onSubmit={handleSendOtp}
              />
            ) : (
              <OtpStep
                email={email}
                otp={otp}
                loading={loading}
                error={error}
                cooldown={cooldown}
                onChange={setOtp}
                onComplete={handleVerifyOtp}
                onResend={handleResend}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function EmailStep({
  email,
  setEmail,
  loading,
  error,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <View className="flex-1">
      <Text className="text-[34px] font-bold leading-[38px] text-foreground">
        Welcome back
      </Text>
      <Text className="mt-2 text-[16px] text-muted">
        Sign up or log in with your email to get going.
      </Text>

      <View className="my-8 items-center justify-center">
        <Image
          source={require('../assets/images/currencies.png')}
          style={{ width: 260, height: 260 }}
          resizeMode="contain"
        />
      </View>

      <TextField isInvalid={!!error}>
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="Your email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          className="rounded-2xl px-5 py-5 text-[16px]"
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </TextField>

      <Button
        onPress={onSubmit}
        isDisabled={loading}
        size="lg"
        className="mt-5 rounded-full bg-foreground"
      >
        {loading ? (
          <Spinner color="#ffffff" />
        ) : (
          <Button.Label className="text-white">Submit</Button.Label>
        )}
      </Button>

      <Text className="mt-6 px-4 text-center text-[13px] leading-[18px] text-muted">
        By continuing, you agree to our{' '}
        <Text className="font-semibold text-foreground">Terms of Service</Text>{' '}
        and{' '}
        <Text className="font-semibold text-foreground">Privacy Policy</Text>.
      </Text>
    </View>
  );
}

function OtpStep({
  email,
  otp,
  loading,
  error,
  cooldown,
  onChange,
  onComplete,
  onResend,
}: {
  email: string;
  otp: string;
  loading: boolean;
  error: string | null;
  cooldown: number;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  onResend: () => void;
}) {
  const mutedColor = useThemeColor('muted');

  return (
    <View className="flex-1">
      <Text className="text-[30px] font-bold leading-[34px] text-foreground">
        Check your email
      </Text>
      <Text className="mt-3 text-[15px] text-muted">
        We sent a login code to:
      </Text>
      <Text className="text-[15px] font-semibold text-foreground">{email}</Text>

      <Text className="mt-5 text-[15px] leading-[22px] text-muted">
        Enter the 6 digit code below. If you don't see it, have a peek in
        your spam folder.
      </Text>

      <View className="my-8 items-center justify-center">
        <Image
          source={require('../assets/images/email-sent.png')}
          style={{ width: 220, height: 220 }}
          resizeMode="contain"
        />
      </View>

      <InputOTP
        value={otp}
        onChange={onChange}
        onComplete={onComplete}
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        isInvalid={!!error}
      >
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group>
          <InputOTP.Slot index={3} />
          <InputOTP.Slot index={4} />
          <InputOTP.Slot index={5} />
        </InputOTP.Group>
      </InputOTP>

      {error ? (
        <Text className="mt-4 text-center text-[13px] text-danger">
          {error}
        </Text>
      ) : null}

      {loading ? (
        <View className="mt-4 items-center">
          <Spinner color={mutedColor} />
        </View>
      ) : null}

      <View className="items-center pt-10 pb-4">
        <Pressable
          onPress={onResend}
          disabled={cooldown > 0 || loading}
          hitSlop={10}
        >
          <Text
            className="text-[15px] font-semibold text-foreground"
            style={{ opacity: cooldown > 0 ? 0.5 : 1 }}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
