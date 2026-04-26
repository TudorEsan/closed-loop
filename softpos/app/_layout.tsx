import "../global.css";

import { useEffect } from "react";
import { HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  GestureHandlerRootView,
  Pressable,
} from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { StripeProvider } from "@stripe/stripe-react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider } from "@/lib/auth-context";
import { QueueProvider } from "@/lib/offline";
import { queryClient } from "@/lib/query";
import { theme } from "@/lib/theme";
import { config } from "@/lib/config";
import { applyDMSansAsDefault, dmSansFontMap } from "@/lib/fonts";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";

applyDMSansAsDefault();
SplashScreen.preventAutoHideAsync().catch(() => {});

const heroUiConfig: HeroUINativeConfig = {
  textProps: {
    allowFontScaling: true,
    adjustsFontSizeToFit: false,
    maxFontSizeMultiplier: 1.5,
    minimumFontScale: 1,
  },
};
export default function RootLayout() {
  const [fontsLoaded] = useFonts(dmSansFontMap);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider
          publishableKey={config.stripePublishableKey}
          merchantIdentifier="merchant.com.softpos"
        >
          <HeroUINativeProvider config={heroUiConfig}>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <QueueProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: theme.colors.background },
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="topup"
                      options={{
                        presentation: "formSheet",
                        headerShown: true,
                        headerTransparent: true,
                        headerTitle: "Top-Up Account",
                        headerLeft: () => (
                          <Pressable
                            onPress={() => router.back()}
                            hitSlop={12}
                            style={{
                              width: 18,
                              height: 18,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name="close" size={18} color="oklch(55.17% 0.0000 248.20)" />
                          </Pressable>
                        ),
                      }}
                    />
                    <Stack.Screen
                      name="transactions"
                      options={{ headerShown: true, title: "Transactions" }}
                    />
                    <Stack.Screen name="select-scope" />
                    <Stack.Screen name="charge" />
                    <Stack.Screen name="settings" />
                  </Stack>
                  <StatusBar style="dark" />
                </QueueProvider>
              </AuthProvider>
            </QueryClientProvider>
          </HeroUINativeProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
