import "../global.css";

import { HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { StripeProvider } from "@stripe/stripe-react-native";

import { AuthProvider } from "@/lib/auth-context";
import { queryClient } from "@/lib/query";
import { theme } from "@/lib/theme";
import { config } from "@/lib/config";

const heroUiConfig: HeroUINativeConfig = {
  textProps: {
    allowFontScaling: true,
    adjustsFontSizeToFit: false,
    maxFontSizeMultiplier: 1.5,
    minimumFontScale: 1,
  },
};
export default function RootLayout() {
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
                  <Stack.Screen name="home" />
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
                  <Stack.Screen
                    name="profile"
                    options={{ headerShown: true, title: "Profile" }}
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
