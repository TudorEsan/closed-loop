import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useScope } from '@/hooks/use-scope';
import type { Scope } from '@/types/api';
import { ScopeList } from './scope-list';

export function ScopePicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { memberships, scope, setScope } = useScope();

  async function handlePick(next: Scope) {
    await setScope(next);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
          <Text className="text-xl font-bold text-foreground">
            Switch scope
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface"
          >
            <Ionicons name="close" size={18} color="#0a0a0a" />
          </Pressable>
        </View>
        <Text className="px-5 pb-4 text-sm text-muted">
          Pick what you want to do right now. You can change this any time.
        </Text>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        >
          {memberships ? (
            <ScopeList
              memberships={memberships}
              activeScope={scope}
              onPick={handlePick}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
