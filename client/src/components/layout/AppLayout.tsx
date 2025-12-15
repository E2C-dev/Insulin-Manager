import { Link, useLocation } from "wouter";
import { Home, NotebookPen, PlusCircle, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: NotebookPen, label: "Logbook", href: "/logbook" },
    { icon: PlusCircle, label: "Entry", href: "/entry", isPrimary: true },
    // { icon: Activity, label: "Stats", href: "/stats" }, // Simplified for now
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans max-w-md mx-auto shadow-2xl overflow-hidden border-x border-border">
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
