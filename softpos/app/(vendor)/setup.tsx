import { useEffect, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  Description,
  Dialog,
  Input,
  Label,
  Select,
  Separator,
  Spinner,
  TextField,
} from 'heroui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { sessionStore } from '@/lib/storage';
import { eventsApi } from '@/lib/api/events';
import { vendorsApi } from '@/lib/api/vendors';
import { extractErrorMessage } from '@/lib/api';
import {
  VENDOR_PRODUCT_TYPES,
  VENDOR_PRODUCT_TYPE_LABELS,
  type VendorProductType,
} from '@/types/api';

export default function VendorSetup() {
  const { signOut } = useAuth();
  const qc = useQueryClient();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Load any previously picked event so we can show it as selected
  useEffect(() => {
    (async () => {
      const saved = await sessionStore.getSelectedEvent();
      if (saved) setSelectedEventId(saved);
    })();
  }, []);

  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.list(),
  });

  const vendorsQuery = useQuery({
    enabled: !!selectedEventId,
    queryKey: ['vendors-for-event', selectedEventId],
    queryFn: () => vendorsApi.listForEvent(selectedEventId as string),
  });

  async function handlePickEvent(eventId: string) {
    setSelectedEventId(eventId);
    await sessionStore.setSelectedEvent(eventId);
  }

  async function handlePickVendor(vendorId: string) {
    await sessionStore.setSelectedVendor(vendorId);
    router.replace('/(vendor)');
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-6 py-6 gap-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Label className="text-2xl font-bold text-foreground">Setup</Label>
          <Description>
            Pick the event and your vendor so we know where you are working.
          </Description>
        </View>

        {/* Step 1: event */}
        <View className="gap-3">
          <Label className="text-base font-semibold text-foreground">
            1. Pick an event
          </Label>

          {eventsQuery.isLoading ? (
            <View className="py-6 items-center">
              <Spinner />
            </View>
          ) : eventsQuery.error ? (
            <Description className="text-danger">
              {extractErrorMessage(eventsQuery.error)}
            </Description>
          ) : (eventsQuery.data ?? []).length === 0 ? (
            <Description>No events around right now.</Description>
          ) : (
            <View className="gap-2">
              {eventsQuery.data?.map((ev) => {
                const active = ev.id === selectedEventId;
                return (
                  <Pressable
                    key={ev.id}
                    onPress={() => handlePickEvent(ev.id)}
                  >
                    <Card
                      variant={active ? 'secondary' : 'default'}
                      className={active ? 'border border-primary' : ''}
                    >
                      <Card.Body className="gap-1">
                        <Label className="text-base font-semibold text-foreground">
                          {ev.name}
                        </Label>
                        <Description>
                          {new Date(ev.startDate).toLocaleDateString()}
                          {'  ->  '}
                          {new Date(ev.endDate).toLocaleDateString()}
                        </Description>
                        <View className="flex-row mt-1">
                          <Chip size="sm" variant="soft">
                            <Chip.Label>{ev.status}</Chip.Label>
                          </Chip>
                        </View>
                      </Card.Body>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Step 2: vendor */}
        {selectedEventId ? (
          <View className="gap-3">
            <Separator />
            <Label className="text-base font-semibold text-foreground">
              2. Pick your vendor
            </Label>

            {vendorsQuery.isLoading ? (
              <View className="py-6 items-center">
                <Spinner />
              </View>
            ) : vendorsQuery.error ? (
              <Description className="text-danger">
                {extractErrorMessage(vendorsQuery.error)}
              </Description>
            ) : (vendorsQuery.data ?? []).length === 0 ? (
              <Card>
                <Card.Body className="gap-3">
                  <Description>
                    You do not have a vendor on this event yet. You can create
                    one now.
                  </Description>
                  <Button onPress={() => setCreateOpen(true)}>
                    Create vendor
                  </Button>
                </Card.Body>
              </Card>
            ) : (
              <View className="gap-2">
                {vendorsQuery.data?.map((v) => (
                  <Pressable key={v.id} onPress={() => handlePickVendor(v.id)}>
                    <Card>
                      <Card.Body className="gap-1">
                        <Label className="text-base font-semibold text-foreground">
                          {v.businessName}
                        </Label>
                        <Description>{v.contactPerson}</Description>
                        <View className="flex-row gap-2 mt-1 flex-wrap">
                          {v.productType ? (
                            <Chip size="sm" variant="soft">
                              <Chip.Label>
                                {VENDOR_PRODUCT_TYPE_LABELS[v.productType]}
                              </Chip.Label>
                            </Chip>
                          ) : null}
                          <Chip
                            size="sm"
                            variant="soft"
                            color={
                              v.status === 'approved' ? 'success' : 'warning'
                            }
                          >
                            <Chip.Label>{v.status}</Chip.Label>
                          </Chip>
                        </View>
                      </Card.Body>
                    </Card>
                  </Pressable>
                ))}

                <Button
                  variant="tertiary"
                  onPress={() => setCreateOpen(true)}
                  className="mt-2"
                >
                  Create another vendor
                </Button>
              </View>
            )}
          </View>
        ) : null}

        <View className="mt-4">
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

      <CreateVendorDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        eventId={selectedEventId}
        onCreated={(vendorId) => {
          qc.invalidateQueries({
            queryKey: ['vendors-for-event', selectedEventId],
          });
          setCreateOpen(false);
          handlePickVendor(vendorId);
        }}
      />
    </SafeAreaView>
  );
}

type CreateVendorDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
  onCreated: (vendorId: string) => void;
};

function CreateVendorDialog({
  isOpen,
  onClose,
  eventId,
  onCreated,
}: CreateVendorDialogProps) {
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState<VendorProductType | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('Pick an event first');
      if (!businessName.trim()) throw new Error('Business name is required');
      if (!contactPerson.trim()) throw new Error('Contact person is required');
      return vendorsApi.create(eventId, {
        businessName: businessName.trim(),
        contactPerson: contactPerson.trim(),
        contactEmail: contactEmail.trim() || undefined,
        productType: productType ?? undefined,
        description: description.trim() || undefined,
      });
    },
    onSuccess: (vendor) => {
      resetForm();
      onCreated(vendor.id);
    },
    onError: (err) => {
      setError(extractErrorMessage(err));
    },
  });

  function resetForm() {
    setBusinessName('');
    setContactPerson('');
    setContactEmail('');
    setDescription('');
    setProductType(null);
    setError(null);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Close />
          <Dialog.Title>New vendor</Dialog.Title>
          <Dialog.Description>
            Fill in your business details. The organizer will review and
            approve it.
          </Dialog.Description>

          <View className="gap-3 mt-2">
            <TextField>
              <Label>Business name</Label>
              <Input
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Cool Kebab"
              />
            </TextField>

            <TextField>
              <Label>Contact person</Label>
              <Input
                value={contactPerson}
                onChangeText={setContactPerson}
                placeholder="Ion Popescu"
              />
            </TextField>

            <TextField>
              <Label>Contact email</Label>
              <Input
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="contact@vendor.ro"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </TextField>

            <View className="gap-1">
              <Label className="text-sm text-foreground">Product type</Label>
              <Select
                value={
                  productType
                    ? {
                        value: productType,
                        label: VENDOR_PRODUCT_TYPE_LABELS[productType],
                      }
                    : undefined
                }
                onValueChange={(opt) => {
                  const single = Array.isArray(opt) ? opt[0] : opt;
                  if (single && single.value) {
                    setProductType(single.value as VendorProductType);
                  }
                }}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Pick one" />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="popover" width="trigger">
                    {VENDOR_PRODUCT_TYPES.map((pt) => (
                      <Select.Item
                        key={pt}
                        value={pt}
                        label={VENDOR_PRODUCT_TYPE_LABELS[pt]}
                      />
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>

            <TextField>
              <Label>Description</Label>
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Short description (optional)"
                multiline
              />
            </TextField>

            {error ? (
              <Description className="text-danger">{error}</Description>
            ) : null}

            <Button
              onPress={() => mutation.mutate()}
              isDisabled={mutation.isPending}
            >
              {mutation.isPending ? <Spinner /> : 'Create vendor'}
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
