'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/card'
import { Button } from '@repo/ui/button'
import { PinInput } from '../../components/molecules/pin-input'
import { useZkLoginSession } from '../../hooks/use-zklogin-session'
import { useAuth } from '../../contexts/auth-context'
import { LoginLayout } from '../../components/templates/login-layout'
import { AlertCircle, Shield, Lock } from 'lucide-react'

export default function SetupSaltPage() {
  const router = useRouter()
  const zkLoginSession = useZkLoginSession()
  const { login } = useAuth()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'setup' | 'confirm'>('setup')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [oauthData, setOauthData] = useState<any>(null)
  const [clearTrigger, setClearTrigger] = useState(0)

  // Check if we have OAuth data from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const idToken = urlParams.get('id_token')
    
    if (idToken) {
      // Decode JWT to get user info
      import('jwt-decode').then(({ jwtDecode }) => {
        const decodedJwt = jwtDecode(idToken) as any
        setOauthData({
          sub: decodedJwt.sub,
          email: decodedJwt.email || '',
          name: decodedJwt.name || '',
          provider: 'google',
          idToken
        })
      })
    }
  }, [])

  const handlePinComplete = (completedPin: string) => {
    setPin(completedPin)
    setError('')
  }

  const handleConfirmPinComplete = (completedPin: string) => {
    setConfirmPin(completedPin)
    setError('')
  }

  const handleNext = () => {
    if (pin.length !== 6) {
      setError('Please enter a 6-digit PIN')
      return
    }
    setStep('confirm')
    setError('')
  }

  const handleConfirm = async () => {
    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setIsLoading(true)
    try {
      // Store the salt using the hook
      zkLoginSession.setUserSaltValue(pin)
      
      // If we have OAuth data, complete the zkLogin flow
      if (oauthData && oauthData.idToken) {
        await completeZkLogin(oauthData.idToken)
      } else {
        // No OAuth data, redirect to login page
        router.push('/login')
      }
    } catch (error) {
      setError('Failed to save PIN. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const completeZkLogin = async (idToken: string) => {
    try {
      const { SuiClient } = await import('@mysten/sui/client')
      const { processOAuthCallback } = await import('../../utils/zklogin-utils')
      
      const suiClient = new SuiClient({ url: 'https://fullnode.devnet.sui.io' })
      
      // Process OAuth callback using utility function
      const { user, sessionData } = await processOAuthCallback(idToken, suiClient)
      
      // Store session data
      zkLoginSession.setSession({
        ephemeralKeyPair: sessionData.ephemeralKeyPair,
        zkProof: sessionData.zkProof,
        maxEpoch: sessionData.maxEpoch,
        userSalt: pin
      })
      
      // Login user
      login(user)
      router.push('/')
      
    } catch (error) {
      console.error('zkLogin completion failed:', error)
      setError('Login failed. Please try again.')
    }
  }

  const handleBack = () => {
    setStep('setup')
    setConfirmPin('')
    setError('')
    setClearTrigger(prev => prev + 1) // Clear the PIN input
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
          <CardTitle className="text-2xl">
            {step === 'setup' ? 'Create Your Salt PIN' : 'Confirm Your Salt PIN'}
          </CardTitle>
          <CardDescription>
            {step === 'setup' 
              ? 'Create a 6-digit PIN that will be used to generate your unique Sui address. This PIN acts as your salt and must be entered each time you log in.'
              : 'Please re-enter your 6-digit PIN to confirm it.'
            }
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
                {step === 'setup' ? 'Enter your 6-digit PIN' : 'Re-enter your 6-digit PIN'}
              </label>
              <PinInput
                onComplete={step === 'setup' ? handlePinComplete : handleConfirmPinComplete}
                onError={setError}
                disabled={isLoading}
                clearTrigger={clearTrigger}
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium">Important Security Information:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• This PIN is used to generate your unique Sui address</li>
                    <li>• You must enter this PIN every time you log in</li>
                    <li>• Store this PIN securely - it cannot be recovered</li>
                    <li>• The PIN is stored locally in your browser session</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {step === 'confirm' && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                className="flex-1"
              >
                Back
              </Button>
            )}
            <Button
              onClick={step === 'setup' ? handleNext : handleConfirm}
              disabled={isLoading || (step === 'setup' ? pin.length !== 6 : confirmPin.length !== 6)}
              className="flex-1"
            >
              {isLoading ? 'Saving...' : step === 'setup' ? 'Continue' : 'Confirm & Continue'}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </LoginLayout>
  )
}
