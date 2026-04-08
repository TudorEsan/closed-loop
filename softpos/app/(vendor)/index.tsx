import { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  Description,
  Label,
  Spinner,
} from 'heroui-native';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { sessionStore } from '@/lib/storage';
import { vendorsApi } from '@/lib/api/vendors';
import { devicesApi } from '@/lib/api/devices';
import { extractErrorMessage } from '@/lib/api';
import {
  VENDOR_PRODUCT_TYPE_LABELS,
  type VendorProductType,
} from '@/types/api';

type Ctx = {
  eventId: string | null;
  vendorId: string | null;
  ready: boolean;
};

export default function VendorHome() {
  const { user, signOut } = useAuth();
  const [ctx, setCtx] = useState<Ctx>({
    eventId: null,
    vendorId: null,
    ready: false,
  });

  useEffect(() => {
    (async () => {
      const eventId = await sessionStore.getSelectedEvent();
      const vendorId = await sessionStore.getSelectedVendor();
      setCtx({ eventId, vendorId, ready: true });
    })();
  }, []);

  const vendorQuery = useQuery({
    enabled: !!ctx.eventId && !!ctx.vendorId,
    queryKey: ['vendor', ctx.eventId, ctx.vendorId],
    queryFn: () => vendorsApi.get(ctx.eventId as string, ctx.vendorId as string),
  });

  const devicesQuery = useQuery({
    enabled: !!ctx.eventId && !!ctx.vendorId,
    queryKey: ['devices', ctx.eventId, ctx.vendorId],
    queryFn: () =>
      devicesApi.listForVendor(ctx.eventId as string, ctx.vendorId as string),
  });

  if (!ctx.ready) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  if (!ctx.eventId || !ctx.vendorId) {
    return <Redirect href="/(vendor)/setup" />;
  }

  if (vendorQuery.isLoading || devicesQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  if (vendorQuery.error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <Label className="text-xl font-semibold text-danger">
            Could not load vendor
          </Label>
          <Description className="text-center">
            {extractErrorMessage(vendorQuery.error)}
          </Description>
          <Button onPress={() => vendorQuery.refetch()}>Try again</Button>
          <Button
            variant="ghost"
            onPress={async () => {
              await sessionStore.clearVendorContext();
              router.replace('/(vendor)/setup');
            }}
          >
            Change vendor
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const vendor = vendorQuery.data;
  const devices = devicesQuery.data?.devices ?? [];
  const hasApproved = devices.some((d) => d.status === 'active');

  if (!hasApproved) {
    return <Redirect href="/(vendor)/register-device" />;
  }

  const productType = vendor?.productType as VendorProductType | null;
  const productLabel = productType
    ? VENDOR_PRODUCT_TYPE_LABELS[productType]
    : 'Not set';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-6 py-6 gap-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Description>Hi {user?.name ?? user?.email}</Description>
          <Label className="text-2xl font-bold text-foreground">
            {vendor?.businessName ?? 'Vendor'}
          </Label>
          <View className="flex-row gap-2 mt-2 flex-wrap">
            <Chip size="sm" variant="soft">
              <Chip.Label>{productLabel}</Chip.Label>
            </Chip>
            <Chip
              size="sm"
              variant="soft"
              color={vendor?.status === 'approved' ? 'success' : 'warning'}
            >
              <Chip.Label>{vendor?.status}</Chip.Label>
            </Chip>
          </View>
        </View>

        <Card>
          <Card.Body className="gap-3">
            <Label className="text-base font-semibold text-foreground">
              Ready to take payments
            </Label>
            <Description>
              Your device is approved. Tap below and start charging wristbands.
            </Description>
            <Button
              onPress={() => router.push('/(vendor)/charge')}
              className="h-16"
            >
              <Button.Label className="text-lg font-semibold">
                Accept payment
              </Button.Label>
            </Button>
          </Card.Body>
        </Card>

        <View className="gap-3">
          <Button
            variant="secondary"
            onPress={() => router.push('/(vendor)/transactions')}
          >
            Transactions
          </Button>
          <Button
            variant="tertiary"
            onPress={() => router.push('/(vendor)/register-device')}
          >
            Manage devices
          </Button>
          <Button
            variant="ghost"
            onPress={async () => {
              await sessionStore.clearVendorContext();
              router.replace('/(vendor)/setup');
            }}
          >
            Switch vendor or event
          </Button>
          <Button
            variant="ghost"
            onPress={async () => {
              await signOut();
              router.replace('/login');
            }}
          >
            Sign out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
