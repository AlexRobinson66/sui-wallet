// zkLogin utility functions for OAuth flow and ZK proof generation

import { SuiClient } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { 
  generateNonce, 
  generateRandomness, 
  genAddressSeed, 
  getZkLoginSignature
} from '@mysten/sui/zklogin'
// @ts-ignore
import { jwtDecode } from 'jwt-decode'
import { GOOGLE_CLIENT_ID, GOOGLE_OAUTH_URL } from './google-oauth'

// zkLogin proof generation options
const USE_MOCK_PROOFS = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_MOCK_PROOFS === 'true'
const PROVER_URL = 'https://prover-dev.mystenlabs.com/v1'

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
export async function generateZkLoginProof(
  jwt: JwtPayload, 
  ephemeralKeyPair: Ed25519Keypair,
  maxEpoch: number, 
  randomness: string,
  jwtToken: string,
  salt: string,
  addressSeed: string
) {
  try {
    if (USE_MOCK_PROOFS) {
      // For development, use mock proofs
      console.log('Generating mock zkLogin proof for development...')
      
      const mockProof = {
        proofPoints: {
          a: "mock_proof_a",
          b: "mock_proof_b", 
          c: "mock_proof_c"
        },
        issBase64Details: {
          value: "mock_iss_value",
          indexMod4: 0
        },
        headerBase64: "mock_header_base64"
      }

      return mockProof
    } else {
      // For production, use real prover service
      console.log('Generating real zkLogin proof...')
      
      const response = await fetch(PROVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jwt: jwtToken,
          extendedEphemeralPublicKey: ephemeralKeyPair.getPublicKey().toBase64(),
          jwtRandomness: randomness,
          maxEpoch,
          keyClaimName: 'sub',
          keyClaimValue: jwt.sub,
          salt: salt,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Prover service error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return await response.json()
    }
  } catch (error) {
    console.error('Failed to generate ZK proof:', error)
    throw error
  }
}

export function generateSuiAddress(zkProof: any, addressSeed: string): string {
  // Use Sui's built-in address generation for zkLogin
  // The address is derived from the addressSeed and zkProof
  try {
    // For now, we'll use a simplified approach
    // In a full implementation, you would use the proper Sui address generation
    return `0x${addressSeed.slice(0, 40)}`
  } catch (error) {
    console.error('Failed to generate Sui address:', error)
    // Fallback to a simple address generation
    return `0x${addressSeed.slice(0, 40)}`
  }
}

export async function processOAuthCallback(
  idToken: string,
  suiClient: SuiClient,
  userSalt: string
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
  
  // Generate ZK proof using Sui's built-in zkLogin
  const zkProof = await generateZkLoginProof(
    decodedJwt, 
    ephemeralKeyPair,
    maxEpoch, 
    randomness, 
    idToken,
    userSalt,
    addressSeed
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
