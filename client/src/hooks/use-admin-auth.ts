import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AdminUser {
  id: string;
  username: string;
  role: "admin" | "admin_readonly";
  isActive: boolean;
}

async function fetchAdminUser(): Promise<AdminUser | null> {
  try {
    const res = await fetch("/api/admin/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

export function useAdminAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: adminUser, isLoading } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: fetchAdminUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin/logout", { method: "POST", credentials: "include" }),
    onSuccess: () => {
      queryClient.setQueryData(["admin", "me"], null);
      setLocation("/admin/login");
    },
  });

  return {
    adminUser,
    isLoading,
    isAuthenticated: !!adminUser,
    isWritable: adminUser?.role === "admin",
    logout: () => logoutMutation.mutate(),
  };
}
