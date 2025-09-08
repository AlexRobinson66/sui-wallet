'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/card'
import { useRouter } from 'next/navigation'
import { 
  GoogleLoginButton, 
  // FacebookLoginButton, 
  // AppleLoginButton,
  // TwitterLoginButton 
} from 'react-social-login-buttons'
import styles from './page.module.css'

const OAUTH_PROVIDERS = [
  { 
    id: 'google', 
    component: GoogleLoginButton,
    text: 'Continue with Google'
  },
  // { 
  //   id: 'facebook', 
  //   component: FacebookLoginButton,
  //   text: 'Continue with Facebook'
  // },
  // { 
  //   id: 'apple', 
  //   component: AppleLoginButton,
  //   text: 'Continue with Apple'
  // },
  // { 
  //   id: 'twitter', 
  //   component: TwitterLoginButton,
  //   text: 'Continue with Twitter'
  // }
]

export default function ZkLoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const router = useRouter()

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const handleOAuthLogin = async (provider: string) => {
    setIsConnecting(provider)
    
    try {
      // Simulate OAuth flow - in real implementation, this would:
      // 1. Redirect to OAuth provider
      // 2. Handle callback with JWT
      // 3. Generate ephemeral key pair
      // 4. Get user salt from salt service
      // 5. Generate ZK proof
      // 6. Derive Sui address
      
      // For demo purposes, simulate a successful login
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockUser = {
        address: '0x15610fa7ee546b96cb580be4060fae1c4bb15eca87f9a0aa931512bad445fc76',
        provider: provider,
        sub: `user_${Math.random().toString(16).substr(2, 8)}`,
        email: `user@${provider}.com`,
        name: `User from ${provider}`
      }
      
      login(mockUser)
      // Redirect to dashboard after successful login
      router.push('/')
    } catch (error) {
      console.error('Login failed:', error)
      alert('Login failed. Please try again.')
    } finally {
      setIsConnecting(null)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src="/sui-logo.svg" 
              alt="Sui Logo" 
              className={`w-12 h-14 ${styles.logo}`}
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Sui Wallet</h1>
            <p className="text-muted-foreground">
              Connect your Sui wallet via your social account privately using zkLogin
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Choose Login Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {OAUTH_PROVIDERS.map((provider) => {
              const ButtonComponent = provider.component
              return (
                <div key={provider.id} className="w-full">
                  <ButtonComponent
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
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground space-y-2">
          <h4 className="font-medium text-foreground">How zkLogin Works:</h4>
          <ul className="space-y-1 text-xs">
            <li>Your OAuth credentials are verified off-chain</li>
            <li>A zero-knowledge proof protects your privacy</li>
            <li>No private keys to manage or remember</li>
            <li>Self-custodial and secure</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
