'use client'

import { useState } from 'react'
import { useAuth } from '../contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/card'
import { Button } from '@repo/ui/button'
import { AuthenticatedLayout } from '../components/templates/authenticated-layout'
import { TokenBalance } from '../components/molecules/token-balance'
import { ReceiveTokenDialog } from '../components/organisms/receive-token-dialog'
import { SendTokenDialog } from '../components/organisms/send-token-dialog'
import { NumberDisplay } from '../components/atoms/number-display'
import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import { TokenBalance as TokenBalanceType } from '../utils/sui-api'

export default function Page() {
  const { user } = useAuth()
  const [balances, setBalances] = useState<TokenBalanceType[]>([])
  const [totalValue, setTotalValue] = useState(0)

  if (!user) {
    return null
  }

  const breadcrumbItems = [
    { label: 'Balances' }
  ]

  const handleBalancesChange = (newBalances: TokenBalanceType[], newTotalValue: number) => {
    setBalances(newBalances)
    setTotalValue(newTotalValue)
  }

  const handleSend = async (token: string, amount: string, recipient: string) => {
    // In a real implementation, this would make an on-chain transaction
    console.log('Sending:', { token, amount, recipient })
    // Simulate transaction
    alert(`Sending ${amount} ${token} to ${recipient}`)
  }

  return (
    <AuthenticatedLayout
      breadcrumbItems={breadcrumbItems}
      balances={balances}
      onSend={handleSend}
    >
      <div className="space-y-6">
        {/* Portfolio Value */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Value</CardTitle>
            <CardDescription>
              Total value of your holdings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">
                  <NumberDisplay value={totalValue} prefix="$" />
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span>+2.5% (24h)</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Assets</div>
                <div className="text-lg font-semibold">
                  <NumberDisplay value={balances.length} decimals={0} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Address Section */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet Address</CardTitle>
            <CardDescription>
              Your zkLogin wallet address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-mono text-sm bg-muted p-3 rounded break-all">
                    {user?.address}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <SendTokenDialog balances={balances} onSend={handleSend} />
                  <ReceiveTokenDialog address={user?.address || ''} />
                </div>
              </div>
              <div className="flex items-center justify-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                  className="text-muted-foreground hover:text-foreground"
                >
                  <a 
                    href={`https://suivision.xyz/account/${user?.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>View on SuiVision Explorer</span>
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Token Balances */}
          <Card>
            <CardHeader>
              <CardTitle>Token Balances</CardTitle>
              <CardDescription>Your current token holdings</CardDescription>
            </CardHeader>
            <CardContent>
              <TokenBalance 
                address={user?.address || ''} 
                onBalancesChange={handleBalancesChange}
              />
            </CardContent>
          </Card>

          {/* zkLogin Info */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Your wallet uses zkLogin technology, which allows you to transact on Sui using your OAuth credentials 
              without revealing your identity or managing private keys.
            </p>
          </div>
      </div>
    </AuthenticatedLayout>
  )
}
