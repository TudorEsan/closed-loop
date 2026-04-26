import NetInfo from "@react-native-community/netinfo";

export function subscribeOnline(cb: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    cb(Boolean(state.isConnected && state.isInternetReachable !== false));
  });
}

export async function getOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(
    state.isConnected && state.isInternetReachable !== false,
  );
}
