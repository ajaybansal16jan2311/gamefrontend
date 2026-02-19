"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { checkAdminSessionCookie } from "@/lib/api";
import { clearAdminToken } from "@/lib/auth";

type AdminAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  setAuthenticated: () => void;
};

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearAdminToken();
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("csrf_token");
    setIsAuthenticated(false);
  }, []);

  const setAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const valid = await checkAdminSessionCookie();
      if (cancelled) return;
      setIsAuthenticated(valid);
      setIsLoading(false);
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AdminAuthState>(
    () => ({
      isAuthenticated,
      isLoading,
      logout,
      setAuthenticated,
    }),
    [isAuthenticated, isLoading, logout, setAuthenticated]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (ctx == null) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
