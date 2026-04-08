import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Description,
  Input,
  Label,
  Spinner,
  TextField,
} from 'heroui-native';
import { router } from 'expo-router';

import { authApi } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { extractErrorMessage } from '@/lib/api';

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
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
    <View
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: '#0a0a0a', marginBottom: 8 }}>
              SoftPOS
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280' }}>
              Sign in with your email, we send you a one time code.
            </Text>
          </View>

          <Card>
            <Card.Body className="gap-4">
              {step === 'email' ? (
                <>
                  <TextField>
                    <Label>Email</Label>
                    <Input
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@email.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                    />
                  </TextField>

                  {error ? (
                    <Description className="text-danger">{error}</Description>
                  ) : null}

                  <Button onPress={handleSendOtp} isDisabled={loading}>
                    {loading ? <Spinner /> : <Button.Label>Send code</Button.Label>}
                  </Button>
                </>
              ) : (
                <>
                  <Description>
                    We sent a 6 digit code to {email}. Enter it below.
                  </Description>

                  <TextField>
                    <Label>Verification code</Label>
                    <Input
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="123456"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </TextField>

                  {error ? (
                    <Description className="text-danger">{error}</Description>
                  ) : null}

                  <Button onPress={handleVerifyOtp} isDisabled={loading}>
                    {loading ? <Spinner /> : <Button.Label>Verify and continue</Button.Label>}
                  </Button>

                  <Button
                    variant="ghost"
                    onPress={() => {
                      setStep('email');
                      setOtp('');
                      setError(null);
                    }}
                  >
                    <Button.Label>Change email</Button.Label>
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
