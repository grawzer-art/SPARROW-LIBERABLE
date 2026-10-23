import { useCallback, useEffect, useState } from 'react';
import { deleteCampaign, listCampaigns } from '../../db/db';
import type { Campaign } from './types';

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setCampaigns(await listCampaigns());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture impossible');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = useCallback(
    async (id: string) => {
      await deleteCampaign(id);
      await reload();
    },
    [reload],
  );

  return { campaigns, error, reload, remove };
}
