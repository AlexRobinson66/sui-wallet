'use client'

import { useAuth } from '../../contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
} from '@repo/ui/sidebar'
import { TopBar } from '../organisms/top-bar'
import { 
  LayoutDashboard, 
  TrendingUp, 
  Activity,
  Settings, 
  LogOut,
  User,
  ExternalLink
} from 'lucide-react'
import { TokenBalance } from '../../utils/sui-api'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
  breadcrumbItems: Array<{ label: string; href?: string }>
  balances: TokenBalance[]
  onSend: (token: string, amount: string, recipient: string) => void
}

export function AuthenticatedLayout({ children, breadcrumbItems, balances, onSend }: AuthenticatedLayoutProps) {
  const { user, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  if (!user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <img 
              src="/sui-logo.svg" 
              alt="Sui Logo" 
              className="w-8 h-10"
            />
            <div>
              <h2 className="font-semibold text-foreground">Sui Wallet</h2>
              <p className="text-xs text-muted-foreground">zkLogin</p>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Balances</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/swap">
                      <TrendingUp className="h-4 w-4" />
                      <span>Swap</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/activity">
                      <Activity className="h-4 w-4" />
                      <span>Activity</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          
          {/* User email */}
          <div className="px-2 py-2 border-t">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                {user.email || 'No email'}
              </span>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset>
        <TopBar breadcrumbItems={breadcrumbItems} balances={balances} onSend={onSend} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}