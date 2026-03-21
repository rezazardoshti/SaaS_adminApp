"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getMe } from "@/services/api/auth";

type UserType = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_email_verified?: boolean;
};

type AuthPayload = {
  access: string;
  refresh: string;
  user?: UserType;
  company?: {
    id: number;
    company_name: string;
  };
};

type AuthContextType = {
  user: UserType | null;
  access: string | null;
  refresh: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: AuthPayload) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [access, setAccess] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedAccess = localStorage.getItem("access");
    const storedRefresh = localStorage.getItem("refresh");

    if (storedAccess) {
      setAccess(storedAccess);
    }

    if (storedRefresh) {
      setRefresh(storedRefresh);
    }
  }, []);

  useEffect(() => {
    async function initAuth() {
      const storedAccess = localStorage.getItem("access");

      if (!storedAccess) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await getMe(storedAccess);
        setUser(me);
        setAccess(storedAccess);
      } catch {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        setUser(null);
        setAccess(null);
        setRefresh(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  async function login(data: AuthPayload) {
    setAccess(data.access);
    setRefresh(data.refresh);

    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);

    if (data.user) {
      setUser(data.user);
      return;
    }

    const me = await getMe(data.access);
    setUser(me);
  }

  function logout() {
    setUser(null);
    setAccess(null);
    setRefresh(null);
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  }

  async function fetchMe() {
    if (!access) return;
    const me = await getMe(access);
    setUser(me);
  }

  const value = useMemo(
    () => ({
      user,
      access,
      refresh,
      isAuthenticated: !!access && !!user,
      isLoading,
      login,
      logout,
      fetchMe,
    }),
    [user, access, refresh, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}