// zkLogin utility functions for OAuth flow and ZK proof generation

import { SuiClient } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { generateNonce, generateRandomness, genAddressSeed } from '@mysten/sui/zklogin'
// @ts-ignore
import { jwtDecode } from 'jwt-decode'
import { GOOGLE_CLIENT_ID, GOOGLE_OAUTH_URL } from './google-oauth'

// Enoki API endpoint for zkLogin ZKP generation
const ENOKI_API_URL = 'https://api.enoki.mystenlabs.com/v1'

// Safe sessionStorage access for SSR compatibility
function getSessionStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return sessionStorage.getItem(key)
  } catch (error) {
    console.error('Failed to access sessionStorage:', error)
    return null
  }
}

function setSessionStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    sessionStorage.setItem(key, value)
  } catch (error) {
    console.error('Failed to set sessionStorage:', error)
  }
}

// JWT payload interface
interface JwtPayload {
  iss?: string
  sub?: string
  aud?: string[] | string
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  email?: string
  name?: string
}

export interface ZkLoginSession {
  ephemeralKeyPair: string
  zkProof: any
  maxEpoch: number
}

export function validateZkLoginSession(session: ZkLoginSession | null): boolean {
  if (!session) return false
  
  try {
    // Check if all required fields are present
    if (!session.ephemeralKeyPair || !session.zkProof || !session.maxEpoch) {
      return false
    }

    // Check if the session is still valid (not expired)
    // In a real implementation, you would check the current epoch against maxEpoch
    // For now, we'll just check if the data exists
    return true
  } catch (error) {
    console.error('Failed to validate zkLogin session:', error)
    return false
  }
}

// Helper functions for zkLogin OAuth flow
export async function getZkProofFromEnoki(
  jwt: JwtPayload, 
  ephemeralPublicKey: string, 
  maxEpoch: number, 
  randomness: string,
  apiKey: string,
  jwtToken: string
) {
  try {
    const response = await fetch(`${ENOKI_API_URL}/zklogin/zkp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'zklogin-jwt': jwtToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network: process.env.NEXT_PUBLIC_SUI_CHAIN || 'mainnet', // or 'testnet' or 'mainnet'
        ephemeralPublicKey: ephemeralPublicKey,
        maxEpoch: maxEpoch,
        randomness: randomness,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Enoki API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get ZK proof from Enoki:', error)
    throw error
  }
}

export function generateSuiAddress(zkProof: any, addressSeed: string): string {
  // This is a simplified implementation
  // In a real implementation, you would use the proper Sui address generation
  // based on the zkProof and addressSeed
  return `0x${addressSeed.slice(0, 40)}`
}

export async function processOAuthCallback(
  idToken: string,
  suiClient: SuiClient,
  userSalt: string,
  enokiApiKey?: string
): Promise<{
  user: {
    address: string
    provider: string
    sub: string
    email?: string
    name?: string
  }
  sessionData: {
    ephemeralKeyPair: string
    zkProof: any
    maxEpoch: number
  }
}> {
  // Decode JWT
  const decodedJwt = jwtDecode(idToken) as JwtPayload
  
  if (!decodedJwt.sub || !decodedJwt.aud) {
    throw new Error('Invalid JWT: missing required fields')
  }

  if (!userSalt) {
    throw new Error('User salt is required.')
  }

  // Generate ephemeral key pair
  const ephemeralKeyPair = new Ed25519Keypair()
  const randomness = generateRandomness()
  
  // Get current epoch info
  const { epoch } = await suiClient.getLatestSuiSystemState()
  const maxEpoch = Number(epoch) + 2
  
  // Generate nonce
  const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness)
  
  // Generate address seed
  const aud = Array.isArray(decodedJwt.aud) ? decodedJwt.aud[0] : decodedJwt.aud
  if (!aud) {
    throw new Error('Invalid JWT: missing audience')
  }
  const addressSeed = genAddressSeed(BigInt(userSalt), 'sub', decodedJwt.sub, aud).toString()
  
  // Get ZK proof from Enoki
  if (!enokiApiKey) {
    throw new Error('Enoki API key is required. Please get your API key from https://portal.enoki.mystenlabs.com/')
  }
  
  const zkProof = await getZkProofFromEnoki(
    decodedJwt, 
    ephemeralKeyPair.getPublicKey().toBase64(), 
    maxEpoch, 
    randomness, 
    enokiApiKey,
    idToken
  )
  
  // Generate Sui address
  const suiAddress = generateSuiAddress(zkProof, addressSeed)
  
  return {
    user: {
      address: suiAddress,
      provider: 'google',
      sub: decodedJwt.sub,
      email: decodedJwt.email || '',
      name: decodedJwt.name || ''
    },
    sessionData: {
      ephemeralKeyPair: JSON.stringify(Array.from(ephemeralKeyPair.getSecretKey())),
      zkProof,
      maxEpoch
    }
  }
}

export async function initiateOAuthFlow(suiClient: SuiClient): Promise<string> {
  // Generate ephemeral key pair
  const ephemeralKeyPair = new Ed25519Keypair()
  const randomness = generateRandomness()
  
  // Get current epoch info
  const { epoch } = await suiClient.getLatestSuiSystemState()
  const maxEpoch = Number(epoch) + 2
  
  // Generate nonce
  const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness)
  
  // Store ephemeral key pair for later use
  setSessionStorageItem('ephemeralKeyPair', JSON.stringify(Array.from(ephemeralKeyPair.getSecretKey())))
  setSessionStorageItem('maxEpoch', maxEpoch.toString())
  

  // Determine redirect URI based on environment
  let redirectUri: string
  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      redirectUri = 'http://localhost:3000/login'
    } else {
      redirectUri = origin + '/login'
    }
  } else {
    // Fallback for SSR
    redirectUri = 'http://localhost:3000/login'
  }
  
  const scope = 'openid email profile'
  
  return `${GOOGLE_OAUTH_URL}?client_id=${GOOGLE_CLIENT_ID}&response_type=id_token&redirect_uri=${redirectUri}&scope=${scope}&nonce=${nonce}`
}
