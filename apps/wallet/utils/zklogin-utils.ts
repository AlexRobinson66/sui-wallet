// zkLogin utility functions for transaction signing

import { SuiClient } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { getZkLoginSignature, generateNonce, generateRandomness, genAddressSeed } from '@mysten/sui/zklogin'
// @ts-ignore
import { jwtDecode } from 'jwt-decode'

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

interface ZkLoginSession {
  ephemeralKeyPair: string
  zkProof: any
  maxEpoch: number
  userSalt: string
}

export async function signTransactionWithZkLogin(
  suiClient: SuiClient,
  transaction: Transaction,
  zkLoginSession: ZkLoginSession
): Promise<string> {
  try {
    // Import the ephemeral key pair
    const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(zkLoginSession.ephemeralKeyPair))
    )

    // Set the sender address
    transaction.setSender(zkLoginSession.zkProof.userSignature)

    // Sign the transaction with the ephemeral key pair
    const { bytes, signature: userSignature } = await transaction.sign({
      client: suiClient,
      signer: ephemeralKeyPair,
    })

    // Generate the zkLogin signature
    const zkLoginSignature = getZkLoginSignature({
      inputs: {
        ...zkLoginSession.zkProof,
        addressSeed: zkLoginSession.zkProof.addressSeed,
      },
      maxEpoch: zkLoginSession.maxEpoch,
      userSignature,
    })

    // Execute the transaction
    const result = await suiClient.executeTransactionBlock({
      transactionBlock: bytes,
      signature: zkLoginSignature,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    })

    return result.digest
  } catch (error) {
    console.error('Failed to sign transaction with zkLogin:', error)
    throw error
  }
}

export function createTransferTransaction(
  recipient: string,
  amount: string,
  coinType: string = '0x2::sui::SUI'
): Transaction {
  const txb = new Transaction()
  
  // Split coins
  const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(amount)])
  
  // Transfer to recipient
  txb.transferObjects([coin], txb.pure.address(recipient))
  
  return txb
}

export function createSwapTransaction(
  fromCoinType: string,
  toCoinType: string,
  amount: string
): Transaction {
  const txb = new Transaction()
  
  // This is a simplified swap transaction
  // In a real implementation, you would integrate with a DEX protocol
  // For now, we'll just create a placeholder transaction
  
  // Split coins
  const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(amount)])
  
  // Placeholder for swap logic
  // In reality, this would call a swap function from a DEX package
  txb.moveCall({
    target: '0x2::coin::join',
    arguments: [txb.object(coin), txb.gas],
  })
  
  return txb
}

export function validateZkLoginSession(session: ZkLoginSession | null): boolean {
  if (!session) return false
  
  try {
    // Check if all required fields are present
    if (!session.ephemeralKeyPair || !session.zkProof || !session.maxEpoch || !session.userSalt) {
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
export async function getZkProofFromEnoki(jwt: JwtPayload, nonce: string, maxEpoch: number) {
  try {
    const response = await fetch('https://prover-dev.mystenlabs.com/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jwt,
        extendedEphemeralPublicKey: nonce,
        jwtRandomness: nonce,
        maxEpoch,
        keyClaimName: 'sub',
        keyClaimValue: jwt.sub,
      }),
    })

    if (!response.ok) {
      throw new Error(`Enoki prover error: ${response.statusText}`)
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
  suiClient: SuiClient
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

  // Check if user has salt set up
  const userSalt = getSessionStorageItem('userSalt')
  if (!userSalt) {
    throw new Error('User salt not found. Please set up your PIN first.')
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
  const zkProof = await getZkProofFromEnoki(decodedJwt, nonce, maxEpoch)
  
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
  
  // Construct Google OAuth URL
  const clientId = '673496460446-cdlciu5oqid0v89i49cbl053jqu2baa5.apps.googleusercontent.com'
  
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
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=id_token&redirect_uri=${redirectUri}&scope=${scope}&nonce=${nonce}`
}
