'use client';

import { useCallback, useState } from 'react';
import HuntJobPanel from './HuntJobPanel';
import ListingExplorer from './ListingExplorer';

export default function AvciV2Workspace() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshListings = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  return (
    <div className="space-y-4">
      <HuntJobPanel
        onJobChange={setJobId}
        onJobFinished={refreshListings}
      />
      <ListingExplorer jobId={jobId} refreshToken={refreshToken} />
    </div>
  );
}
