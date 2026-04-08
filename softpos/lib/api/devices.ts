import { api } from '../api';
import type { Device } from '@/types/api';

export type RegisterDeviceBody = {
  registrationToken: string;
  deviceModel: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  screenWidth: number;
  screenHeight: number;
  registrationLatitude?: number;
  registrationLongitude?: number;
  deviceFingerprint: string;
};

export const devicesApi = {
  async register(
    eventId: string,
    vendorId: string,
    body: RegisterDeviceBody,
  ): Promise<Device> {
    const res = await api.post<Device>(
      `/events/${eventId}/vendors/${vendorId}/devices/register`,
      body,
    );
    return res.data;
  },

  async listForVendor(
    eventId: string,
    vendorId: string,
  ): Promise<{ devices: Device[] }> {
    const res = await api.get(
      `/events/${eventId}/vendors/${vendorId}/devices`,
    );
    return res.data;
  },

  async get(eventId: string, deviceId: string): Promise<Device> {
    const res = await api.get<Device>(`/events/${eventId}/devices/${deviceId}`);
    return res.data;
  },
};
