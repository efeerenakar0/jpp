'use client';

import { createContext, useContext } from 'react';

export type FabrikaClientSession = {
  principalType: 'OWNER' | 'EMPLOYEE';
  displayName: string;
  permissions: {
    canManageTeam: boolean;
    canManageSecrets: boolean;
    canViewSubscription: boolean;
    canEditReports: boolean;
  };
};

const FabrikaSessionContext = createContext<FabrikaClientSession | null>(null);

export function FabrikaSessionProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: FabrikaClientSession;
}) {
  return (
    <FabrikaSessionContext.Provider value={value}>
      {children}
    </FabrikaSessionContext.Provider>
  );
}

export function useFabrikaSession(): FabrikaClientSession {
  const session = useContext(FabrikaSessionContext);

  if (!session) {
    throw new Error(
      'useFabrikaSession yalnızca FabrikaSessionProvider içinde kullanılabilir.'
    );
  }

  return session;
}
