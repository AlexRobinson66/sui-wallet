'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/card'
import { Button } from '@repo/ui/button'
import { PinInput } from '../../components/molecules/pin-input'
import { useZkLoginSession } from '../../hooks/use-zklogin-session'
import { LoginLayout } from '../../components/templates/login-layout'
import { AlertCircle, Shield, ArrowLeft } from 'lucide-react'

export default function VerifySaltPage() {
  const router = useRouter()
  const zkLoginSession = useZkLoginSession()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [clearTrigger, setClearTrigger] = useState(0)

  const handlePinComplete = (completedPin: string) => {
    setPin(completedPin)
    setError('')
  }

  const handleVerify = async () => {
    if (pin.length !== 6) {
      setError('Please enter a 6-digit PIN')
      return
    }

    setIsLoading(true)
    try {
      // Verify the PIN matches the stored salt
      if (!zkLoginSession.hasSalt()) {
        setError('No salt found. Please set up your PIN first.')
        return
      }

      if (pin !== zkLoginSession.userSalt) {
        setError('Incorrect PIN. Please try again.')
        setClearTrigger(prev => prev + 1) // Clear the PIN input
        return
      }

      // PIN is correct, proceed with login
      router.push('/login')
    } catch (error) {
      setError('Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    router.push('/login')
  }

  return (
    <LoginLayout>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Enter Your Salt PIN</CardTitle>
          <CardDescription>
            Please enter your 6-digit PIN to continue with the login process.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center">
              <label className="text-sm font-medium text-muted-foreground mb-4 block">
                Enter your 6-digit PIN
              </label>
              <PinInput
                onComplete={handlePinComplete}
                onError={setError}
                disabled={isLoading}
                clearTrigger={clearTrigger}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isLoading || pin.length !== 6}
              className="flex-1"
            >
              {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </LoginLayout>
  )
}
