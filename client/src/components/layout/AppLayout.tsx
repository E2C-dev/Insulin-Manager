import { Link, useLocation } from "wouter";
import { Home, NotebookPen, PlusCircle, Settings, LogOut, User, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();

  const navItems = [
    { icon: Home, label: "ホーム", href: "/" },
    { icon: NotebookPen, label: "記録", href: "/logbook" },
    { icon: PlusCircle, label: "入力", href: "/entry", isPrimary: true },
    { icon: Activity, label: "ルール", href: "/adjustment-rules" },
    { icon: Settings, label: "設定", href: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans max-w-md mx-auto shadow-2xl overflow-hidden border-x border-border">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user?.username}</span>
              <span className="text-xs text-muted-foreground">ようこそ</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>アカウント</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <a className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4" />
                    設定
                  </a>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                disabled={isLoggingOut}
                className="text-red-600 focus:text-red-600 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isLoggingOut ? "ログアウト中..." : "ログアウト"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 no-scrollbar">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border z-50 max-w-md mx-auto safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            if (item.isPrimary) {
              return (
                <Link key={item.href} href={item.href}>
                  <a className="relative -top-5">
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95",
                      "bg-primary text-primary-foreground border-4 border-background"
                    )}>
                      <Icon size={28} strokeWidth={2.5} />
                    </div>
                  </a>
                </Link>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <a className={cn(
                  "flex flex-col items-center justify-center w-16 py-1 transition-colors duration-200 gap-1",
                  isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                )}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px]">{item.label}</span>
                </a>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
