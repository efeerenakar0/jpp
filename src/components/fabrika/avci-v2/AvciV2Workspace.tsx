'use client';

import { useCallback, useState } from 'react';
import HuntJobPanel from './HuntJobPanel';
import type { HuntScanContext } from './HuntQuotaGuide';
import ListingExplorer from './ListingExplorer';

export default function AvciV2Workspace() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [scanContext, setScanContext] = useState<HuntScanContext | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshListings = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  return (
    <div className="space-y-4">
      <HuntJobPanel
        onJobChange={setJobId}
        onJobFinished={refreshListings}
        onScanContextChange={setScanContext}
      />
      <ListingExplorer
        jobId={jobId}
        refreshToken={refreshToken}
        scanContext={scanContext}
      />
    </div>
  );
}
