import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { LanguageProvider } from "@/context/LanguageContext";
import { AtmosphericProvider } from "@/context/AtmosphericContext";
import { FarmerProfileProvider } from "@/context/FarmerProfileContext";
import { ExpertCallProvider } from "@/context/ExpertCallContext";
import { AssistantProvider } from "@/context/AssistantContext";
import AtmosphericShell from "@/components/AtmosphericShell";
import ExpertCallModal from "@/components/ExpertCallModal";
import FarmerAssistantModal from "@/components/farmer/FarmerAssistantModal";

export const metadata: Metadata = {
  title: "Plant Doctor AI",
  description: "Smart Farming Assistant & Premium App",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f8fbff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="antialiased" suppressHydrationWarning>
        <LanguageProvider>
          <FarmerProfileProvider>
            <ExpertCallProvider>
              <AssistantProvider>
                <AtmosphericProvider>
                  <AtmosphericShell>
                    <AppShell>{children}</AppShell>
                    <ExpertCallModal />
                    <FarmerAssistantModal />
                  </AtmosphericShell>
                </AtmosphericProvider>
              </AssistantProvider>
            </ExpertCallProvider>
          </FarmerProfileProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
