'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Removido useSession e signIn, pois NextAuth.js foi desabilitado.

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '24px' }}>
      Redirecionando para o Dashboard...
    </div>
  );
}
