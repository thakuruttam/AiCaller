import { DashboardSidebar } from './components/web3/sidebar';
import './dashboard.css';

import { SidebarInset, SidebarProvider } from './ui/sidebar';
import { PortalContainerProvider } from './ui/portal-container';
import type { CSSProperties } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      className="web3-dashboard bg-background text-foreground min-h-screen font-sans"
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 64)',
          '--sidebar-width-icon': 'calc(var(--spacing) * 14)',
        } as CSSProperties
      }
    >
      <PortalContainerProvider>
        <DashboardSidebar />
        <SidebarInset>
          {children}
        </SidebarInset>
      </PortalContainerProvider>
    </SidebarProvider>
  );
}
