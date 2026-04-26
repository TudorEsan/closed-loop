export const config = {
  apiBaseUrl: `https://oyster-app-wpqlj.ondigitalocean.app/api/v1`,
  authBaseUrl: `https://oyster-app-wpqlj.ondigitalocean.app`,
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  // Hex-encoded HKDF input. The thesis flags secure provisioning as future
  // work; for the demo we read it from the env and fall back to a dev value
  // so a fresh checkout still runs.
  braceletMasterKeyHex:
    process.env.EXPO_PUBLIC_BRACELET_MASTER_KEY ||
    "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
};
