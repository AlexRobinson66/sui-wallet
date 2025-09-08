'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/dialog'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Label } from '@repo/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/select'
import { NumberDisplay } from './number-display'
import { TokenBalance } from '../lib/sui-api'

interface SendTokenDialogProps {
  balances: TokenBalance[]
  onSend: (token: string, amount: string, recipient: string) => void
}

export function SendTokenDialog({ balances, onSend }: SendTokenDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!selectedToken || !amount || !recipient) return
    
    setIsLoading(true)
    try {
      await onSend(selectedToken, amount, recipient)
      setOpen(false)
      setSelectedToken('')
      setAmount('')
      setRecipient('')
    } catch (error) {
      console.error('Send failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedTokenData = balances.find(b => b.symbol === selectedToken)
  const maxAmount = selectedTokenData?.balance || '0'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Send</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Tokens</DialogTitle>
          <DialogDescription>
            Transfer tokens to another wallet address
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Select Token</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a token" />
              </SelectTrigger>
              <SelectContent>
                {balances.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    <div className="flex items-center space-x-2">
                      <span>{token.symbol}</span>
                      <span className="text-muted-foreground">
                        Balance: <NumberDisplay value={token.balance} decimals={6} />
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="flex space-x-2">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.000001"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount(maxAmount)}
              >
                Max
              </Button>
            </div>
            {selectedTokenData && (
              <p className="text-sm text-muted-foreground">
                Available: <NumberDisplay value={selectedTokenData.balance} decimals={6} /> {selectedTokenData.symbol}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>

          {selectedTokenData && amount && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span><NumberDisplay value={amount} decimals={6} /> {selectedTokenData.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>Value:</span>
                  <span><NumberDisplay value={(parseFloat(amount) * selectedTokenData.price).toString()} prefix="$" /></span>
                </div>
                <div className="flex justify-between">
                  <span>Gas Fee:</span>
                  <span>~0.001 SUI</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!selectedToken || !amount || !recipient || isLoading}
              className="flex-1"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
