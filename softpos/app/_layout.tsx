import "../global.css";

import { useEffect } from "react";
import { HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { StripeProvider } from "@stripe/stripe-react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider } from "@/lib/auth-context";
import { queryClient } from "@/lib/query";
import { theme } from "@/lib/theme";
import { config } from "@/lib/config";
import { applyDMSansAsDefault, dmSansFontMap } from "@/lib/fonts";

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
                      presentation: "modal",
                      headerShown: true,
                      title: "Add funds",
                    }}
                  />
                  <Stack.Screen
                    name="transactions"
                    options={{ headerShown: true, title: "Transactions" }}
                  />
                </Stack>
                <StatusBar style="dark" />
              </AuthProvider>
            </QueryClientProvider>
          </HeroUINativeProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
