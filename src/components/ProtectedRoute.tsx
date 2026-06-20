'use client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('admin' | 'caller' | 'checker' | 'viewer')[];
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}
