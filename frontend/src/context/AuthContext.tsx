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
  role?: "owner" | "admin" | "employee" | null;
  can_access_admin_dashboard?: boolean;
  can_access_employee_workspace?: boolean;
};

type MembershipType = {
  id: number;
  role: "owner" | "admin" | "employee";
  employee_number?: string | null;
  job_title?: string | null;
  department?: string | null;
  employment_status?: string | null;
  is_active: boolean;
  monthly_target_hours?: number | null;
};

type CompanyType = {
  id: number;
  public_id?: string;
  company_name: string;
  industry?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  is_active?: boolean;
};

type AuthPayload = {
  access: string;
  refresh: string;
  user?: UserType;
  membership?: MembershipType | null;
  company?: CompanyType | null;
  redirect_to?: string;
};

type AuthContextType = {
  user: UserType | null;
  membership: MembershipType | null;
  company: CompanyType | null;
  access: string | null;
  refresh: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: AuthPayload) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  getDefaultRoute: () => string;
  canAccessAdminDashboard: boolean;
  canAccessEmployeeWorkspace: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [membership, setMembership] = useState<MembershipType | null>(null);
  const [company, setCompany] = useState<CompanyType | null>(null);
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

        const savedCompany = localStorage.getItem("company");
        const savedMembership = localStorage.getItem("membership");

        setCompany(savedCompany ? JSON.parse(savedCompany) : null);
        setMembership(savedMembership ? JSON.parse(savedMembership) : null);
      } catch {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("company");
        localStorage.removeItem("membership");

        setUser(null);
        setMembership(null);
        setCompany(null);
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

    if (data.company) {
      setCompany(data.company);
      localStorage.setItem("company", JSON.stringify(data.company));
    } else {
      setCompany(null);
      localStorage.removeItem("company");
    }

    if (data.membership) {
      setMembership(data.membership);
      localStorage.setItem("membership", JSON.stringify(data.membership));
    } else {
      setMembership(null);
      localStorage.removeItem("membership");
    }

    if (data.user) {
      setUser(data.user);
      return;
    }

    const me = await getMe(data.access);
    setUser(me);
  }

  function logout() {
    setUser(null);
    setMembership(null);
    setCompany(null);
    setAccess(null);
    setRefresh(null);

    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("company");
    localStorage.removeItem("membership");
  }

  async function fetchMe() {
    if (!access) return;

    const me = await getMe(access);
    setUser(me);
  }

  function getDefaultRoute() {
    if (user?.is_superuser) return "/dashboard";
    if (user?.role === "employee") return "/workspace";
    if (user?.role === "admin" || user?.role === "owner") return "/workspace";
    return "/login";
  }

  const canAccessAdminDashboard =
    !!user?.is_superuser || !!user?.can_access_admin_dashboard;

  const canAccessEmployeeWorkspace =
    !!user?.is_superuser || !!user?.can_access_employee_workspace;

  const value = useMemo(
    () => ({
      user,
      membership,
      company,
      access,
      refresh,
      isAuthenticated: !!access && !!user,
      isLoading,
      login,
      logout,
      fetchMe,
      getDefaultRoute,
      canAccessAdminDashboard,
      canAccessEmployeeWorkspace,
    }),
    [
      user,
      membership,
      company,
      access,
      refresh,
      isLoading,
      canAccessAdminDashboard,
      canAccessEmployeeWorkspace,
    ]
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