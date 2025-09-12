'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleLoginButton } from 'react-social-login-buttons'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/card'
import { initiateOAuthFlow, processOAuthCallback } from '@/utils/zk-login'
import { useZkLoginSession } from '@/hooks/use-zklogin-session'
import { useAuth } from '@/contexts/auth-context'
import { LoginLayout } from '@/components/templates/login-layout'
import { SaltForm } from '@/components/organisms/salt-form'
import { LoadingSpinner } from '@/components/atoms/loading-spinner'
import { suiClient } from '@/utils/sui'
import { AlertCircle } from 'lucide-react'
import styles from './page.module.css'

// Sui network configuration
const SUI_NETWORK = process.env.NEXT_PUBLIC_SUI_CHAIN || 'devnet'

const OAUTH_PROVIDERS = [
  { 
    id: 'google', 
    component: GoogleLoginButton,
    text: 'Continue with Google'
  }
]

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  const zkLoginSession = useZkLoginSession()
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [oauthData, setOauthData] = useState<any>(null)
  const [showPinInput, setShowPinInput] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false)

  // Check for OAuth callback
  useEffect(() => {
    // Check both query parameters and URL fragment for id_token
    const urlParams = new URLSearchParams(window.location.search)
    const fragmentParams = new URLSearchParams(window.location.hash.substring(1))
    
    const idToken = urlParams.get('id_token') || fragmentParams.get('id_token')

    if (idToken) {
      setIdToken(idToken)
      handleOAuthCallback(idToken)
    }
  }, [])

  const handleOAuthCallback = async (idToken: string) => {
    try {
      setIsConnecting('google')
      
      // Decode JWT to get user info
      const { jwtDecode } = await import('jwt-decode')
      const decodedJwt = jwtDecode(idToken) as any
      
      setOauthData({
        sub: decodedJwt.sub,
        email: decodedJwt.email || '',
        name: decodedJwt.name || '',
        provider: 'google'
      })
      
      // Show PIN input instead of redirecting
      setShowPinInput(true)
    } catch (error) {
      console.error('OAuth callback failed:', error)
      setLoginError('Authentication failed. Please try again.')
    } finally {
      setIsConnecting(null)
    }
  }

  const handlePinComplete = async (pin: string) => {
    setShowPinInput(false)

    if (!oauthData || !idToken) {
      setLoginError('No authentication data found. Please try logging in again.')
      return
    }

    setIsProcessingOAuth(true)
    setLoginError('')

    try {
      // Process OAuth callback using utility function with the PIN as salt
      const { user, sessionData } = await processOAuthCallback(idToken, suiClient, pin)
      
      // Store session data
      zkLoginSession.setSession({
        ephemeralKeyPair: sessionData.ephemeralKeyPair,
        zkProof: sessionData.zkProof,
        maxEpoch: sessionData.maxEpoch
      })

      // Login user
      login(user)
      router.push('/')
    } catch (error) {
      console.error('Authentication failed:', error)
      setLoginError('Authentication failed. Please try again.')
    } finally {
      setIsProcessingOAuth(false)
    }
  }

  const handlePinBack = () => {
    setShowPinInput(false)
    setOauthData(null)
  }

  const handleOAuthLogin = async (provider: string) => {
    if (provider !== 'google') {
      alert('Only Google OAuth is currently supported')
      return
    }

    try {
      setIsConnecting(provider)
      
      const { url, data } = await initiateOAuthFlow(suiClient)
      
      // Store OAuth data using the session storage hook
      zkLoginSession.setEphemeralKeyPair(data.ephemeralKeyPair)
      zkLoginSession.setMaxEpoch(data.maxEpoch)
      
      // Redirect to Google OAuth
      window.location.href = url
    } catch (error) {
      console.error('OAuth login failed:', error)
      setLoginError('Authentication failed. Please try again.')
    } finally {
      setIsConnecting(null)
    }
  }

  // Show loading screen during OAuth processing
  if (isProcessingOAuth) {
    return <LoadingSpinner message="Connecting to your wallet..." />
  }

  // Show PIN input if OAuth completed
  if (showPinInput) {
    return (
      <LoginLayout>       
        <SaltForm
          onPinComplete={handlePinComplete}
          onBack={handlePinBack}
        />
      </LoginLayout>
    )
  }

  // Otherwise show the social login options
  return (
    <LoginLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center">
            <img 
              src="/sui-logo.svg" 
              alt="Sui Logo" 
              className={`w-12 h-14 ${styles.logo}`}
            />
          </div>

          <CardTitle className="text-2xl">
            Welcome to Sui Wallet
          </CardTitle>

          <CardDescription>
            Sign in with your Google account to access your zkLogin wallet
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {loginError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{loginError}</span>
            </div>
          )}

          {OAUTH_PROVIDERS.map((provider) => {
            const ButtonComponent = provider.component
            return (
              <ButtonComponent
                key={provider.id}
                onClick={() => handleOAuthLogin(provider.id)}
                disabled={isConnecting !== null}
                className={styles.socialLoginButton}
                style={{
                  width: '100%',
                  height: '48px',
                  fontSize: '16px',
                  opacity: isConnecting === provider.id ? 0.7 : 1,
                  cursor: isConnecting === provider.id ? 'not-allowed' : 'pointer'
                }}
              >
                {isConnecting === provider.id ? (
                  <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <span>Connecting...</span>
                  </div>
                ) : (
                  <span>{provider.text}</span>
                )}
              </ButtonComponent>
            )
          })}
        </CardContent>

        <CardFooter>
          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </LoginLayout>
  )
}