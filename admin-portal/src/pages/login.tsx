import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { signIn, emailOtp } from '@/lib/auth-client';
import { useAuth } from '@/lib/auth-provider';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendOtp = useCallback(async (targetEmail: string) => {
    await emailOtp.sendVerificationOtp({
      email: targetEmail,
      type: 'sign-in',
    });
    setCooldown(30);
  }, []);

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSending(true);
    try {
      await sendOtp(email);
      setStep('otp');
    } catch {
      toast.error('Failed to send verification code. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const verifyOtp = useCallback(
    async (code: string) => {
      if (code.length !== 6) return;
      setIsVerifying(true);
      try {
        const result = await signIn.emailOtp({
          email,
          otp: code,
        });

        if (result.error) {
          toast.error(result.error.message || 'Invalid code. Please try again.');
          setOtp('');
          setIsVerifying(false);
          return;
        }

        toast.success('Signed in successfully');
        navigate('/dashboard', { replace: true });
      } catch {
        toast.error('Verification failed. Please try again.');
        setOtp('');
        setIsVerifying(false);
      }
    },
    [email, navigate],
  );

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await sendOtp(email);
      toast.success('A new code has been sent to your email');
    } catch {
      toast.error('Could not resend the code. Please try again.');
    }
  };

  const goBack = () => {
    setStep('email');
    setOtp('');
    setCooldown(0);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {step === 'email' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Welcome back</CardTitle>
              <CardDescription>
                Enter your email to sign in to the admin portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onEmailSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <Button type="submit" className="w-full" disabled={isSending}>
                      {isSending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Sending code...
                        </>
                      ) : (
                        'Continue'
                      )}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 'otp' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Check your email</CardTitle>
              <CardDescription>
                We sent a 6-digit code to{' '}
                <span className="font-medium text-foreground">
                  {maskEmail(email)}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-5">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => {
                    setOtp(value);
                    if (value.length === 6) {
                      verifyOtp(value);
                    }
                  }}
                  disabled={isVerifying}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>

                {isVerifying && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Verifying...
                  </div>
                )}

                <FieldDescription className="text-center">
                  {cooldown > 0 ? (
                    <span>Resend code in {cooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Resend code
                    </button>
                  )}
                </FieldDescription>

                <Button variant="ghost" size="sm" onClick={goBack}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <FieldDescription className="px-6 text-center">
          This portal is restricted to authorized administrators only.
        </FieldDescription>
      </div>
    </div>
  );
}
