import { api } from "../api";
import type { SyncRequest, SyncResponse } from "@/types/sync";

export const reconciliationApi = {
  async sync(
    eventId: string,
    wristbandUid: string,
    body: SyncRequest,
  ): Promise<SyncResponse> {
    const res = await api.post<SyncResponse>(
      `/events/${eventId}/wristbands/${wristbandUid}/sync`,
      body,
    );
    return res.data;
  },
};
