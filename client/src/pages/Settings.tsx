import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Camera, User, Settings as SettingsIcon, LogOut, ChevronRight, UploadCloud } from "lucide-react";
import { DEFAULT_SETTINGS } from "@/lib/types";

export default function Settings() {
  return (
    <AppLayout>
      <div className="pt-12 px-6 pb-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your therapy profile</p>
        </div>

        {/* Account */}
        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <User className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Alex Doe</h3>
              <p className="text-sm text-muted-foreground">Type 1 • Since 2018</p>
            </div>
            <Button variant="ghost" size="icon">
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        {/* AI Import Feature */}
        <Card className="overflow-hidden border-primary/20 shadow-md">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-5 h-5" />
              <h3 className="font-bold">Scan Logbook</h3>
            </div>
            <p className="text-xs opacity-80">Import handwritten notes using AI</p>
          </div>
          <CardContent className="p-4">
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Take a photo of your paper logbook to automatically digitize your history.
              </p>
              <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 border-0">
                <Camera className="w-4 h-4 mr-2" /> Open Camera
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Therapy Settings */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            Therapy Settings
          </h3>
          
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">Basal Rates (Units)</CardTitle>
              <CardDescription>Your standard background insulin</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 grid grid-cols-4 gap-2">
              {Object.entries(DEFAULT_SETTINGS.basalRates).map(([slot, value]) => (
                <div key={slot} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{slot}</Label>
                  <Input type="number" defaultValue={value} className="h-9 text-center" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">Correction Rules</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <Label className="text-sm">Correction Factor (ISF)</Label>
                  <p className="text-xs text-muted-foreground">1 unit drops glucose by</p>
                </div>
                <div className="flex items-center gap-2 w-24">
                  <Input type="number" defaultValue={DEFAULT_SETTINGS.insulinSensitivityFactor} className="h-8 text-right" />
                  <span className="text-xs text-muted-foreground">mg/dL</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <Label className="text-sm">Carb Ratio (I:C)</Label>
                  <p className="text-xs text-muted-foreground">1 unit covers</p>
                </div>
                <div className="flex items-center gap-2 w-24">
                  <Input type="number" defaultValue={DEFAULT_SETTINGS.carbRatio} className="h-8 text-right" />
                  <span className="text-xs text-muted-foreground">g</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* App Settings */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
            <span className="text-sm font-medium">Notifications</span>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
            <span className="text-sm font-medium">Export Data (PDF)</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <Button variant="destructive" className="w-full mt-6" size="lg">
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
