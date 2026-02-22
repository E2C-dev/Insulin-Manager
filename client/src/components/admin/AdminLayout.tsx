import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Flag,
  ScrollText,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "概要", href: "/admin" },
  { icon: Users, label: "ユーザー管理", href: "/admin/users" },
  { icon: Flag, label: "機能フラグ", href: "/admin/feature-flags" },
  { icon: ScrollText, label: "監査ログ", href: "/admin/audit-logs" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { adminUser, logout, isWritable } = useAdminAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* サイドバー */}
      <aside className="w-64 bg-white border-r border-border flex flex-col shrink-0">
        {/* ヘッダー */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">管理者パネル</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground truncate">
              {adminUser?.username}
            </span>
            <Badge
              variant={isWritable ? "default" : "secondary"}
              className="text-[10px] shrink-0"
            >
              {isWritable ? "管理者" : "閲覧のみ"}
            </Badge>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ icon: Icon, label, href }) => (
            <Link key={href} href={href}>
              <a
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  location === href ||
                    (href !== "/admin" && location.startsWith(href))
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </a>
            </Link>
          ))}
        </nav>

        {/* ログアウト */}
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </Button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
