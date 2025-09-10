'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/card'
import { useRouter } from 'next/navigation'
import { GoogleLoginButton } from 'react-social-login-buttons'
import { SuiClient } from '@mysten/sui/client'
import { processOAuthCallback, initiateOAuthFlow } from '../../utils/zklogin-utils'
import { useZkLoginSession } from '../../hooks/use-zklogin-session'
import { LoginLayout } from '../../components/templates/login-layout'
import styles from './page.module.css'

const OAUTH_PROVIDERS = [
  { 
    id: 'google', 
    component: GoogleLoginButton,
    text: 'Continue with Google'
  }
]

export default function LoginPage() {
  const { login } = useAuth()
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [oauthData, setOauthData] = useState<any>(null)
  const router = useRouter()
  const zkLoginSession = useZkLoginSession()

  // Sui client for devnet
  const suiClient = new SuiClient({ url: 'https://fullnode.devnet.sui.io' })

  // Check for OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const idToken = urlParams.get('id_token')
    
    if (idToken) {
      handleOAuthCallback(idToken)
    }
  }, [])

  const handleOAuthCallback = async (idToken: string) => {
    try {
      setIsConnecting('google')
      
      // Decode JWT to get user info
      const { jwtDecode } = await import('jwt-decode')
      const decodedJwt = jwtDecode(idToken) as any
      
      // Store OAuth data temporarily
      const oauthUserData = {
        sub: decodedJwt.sub,
        email: decodedJwt.email || '',
        name: decodedJwt.name || '',
        provider: 'google'
      }
      
      setOauthData(oauthUserData)
      
      // Check if user has salt set up for this account
      const existingSalt = zkLoginSession.userSalt
      
      if (!existingSalt) {
        // No salt found, redirect to PIN setup
        router.push('/setup-salt')
        return
      }
      
      // Salt exists, proceed with zkLogin
      await completeZkLogin(oauthUserData, idToken)
      
    } catch (error) {
      console.error('OAuth callback failed:', error)
      alert('Login failed. Please try again.')
    } finally {
      setIsConnecting(null)
    }
  }

  const completeZkLogin = async (oauthUserData: any, idToken: string) => {
    try {
      // Process OAuth callback using utility function
      const { user, sessionData } = await processOAuthCallback(idToken, suiClient)
      
      // Store session data
      zkLoginSession.setSession({
        ephemeralKeyPair: sessionData.ephemeralKeyPair,
        zkProof: sessionData.zkProof,
        maxEpoch: sessionData.maxEpoch,
        userSalt: zkLoginSession.userSalt
      })
      
      // Login user
      login(user)
      router.push('/')
      
    } catch (error) {
      console.error('zkLogin completion failed:', error)
      alert('Login failed. Please try again.')
    }
  }

  const handleOAuthLogin = async (provider: string) => {
    if (provider !== 'google') {
      alert('Only Google OAuth is currently supported')
      return
    }

    try {
      setIsConnecting(provider)
      
      // Always start with OAuth - don't check for salt first
      // The OAuth callback will handle salt checking
      const oauthUrl = await initiateOAuthFlow(suiClient)
      
      // Redirect to Google OAuth
      window.location.href = oauthUrl
      
    } catch (error) {
      console.error('OAuth login failed:', error)
      alert('Login failed. Please try again.')
    } finally {
      setIsConnecting(null)
    }
  }

  return (
    <LoginLayout>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center">
            <img 
              src="/sui-logo.svg" 
              alt="Sui Logo" 
              className={`w-12 h-14 ${styles.logo}`}
            />
          </div>
          <CardTitle className="text-2xl">Welcome to Sui Wallet</CardTitle>
          <CardDescription>
            Sign in with your Google account to access your zkLogin wallet
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
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
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </LoginLayout>
  )
}