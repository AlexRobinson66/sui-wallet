'use client'

import { useCallback, useState } from 'react'
import { useSessionStorage, useSessionStorageString, useSessionStorageNumber, useSessionStorageBoolean } from './use-session-storage'

interface ZkLoginSession {
  ephemeralKeyPair: string
  zkProof: any
  maxEpoch: number
  userSalt: string // This will be stored in memory only, not sessionStorage
}

/**
 * Custom hook for managing zkLogin session data
 * Provides safe access to all zkLogin-related sessionStorage values
 */
export function useZkLoginSession() {
  const [ephemeralKeyPair, setEphemeralKeyPair, clearEphemeralKeyPair] = useSessionStorageString('ephemeralKeyPair', '')
  const [zkProof, setZkProof, clearZkProof] = useSessionStorage('zkProof', null)
  const [maxEpoch, setMaxEpoch, clearMaxEpoch] = useSessionStorageNumber('maxEpoch', 0)
  const [hasUserSalt, setHasUserSalt, clearHasUserSalt] = useSessionStorageBoolean('hasUserSalt', false)
  
  // Store actual salt in memory only (not persistent)
  const [userSalt, setUserSalt] = useState<string>('')

  // Get complete session data
  const getSession = useCallback((): ZkLoginSession | null => {
    if (!ephemeralKeyPair || !zkProof || !maxEpoch || !userSalt) {
      return null
    }

    return {
      ephemeralKeyPair,
      zkProof,
      maxEpoch,
      userSalt
    }
  }, [ephemeralKeyPair, zkProof, maxEpoch, userSalt])

  // Set complete session data
  const setSession = useCallback((session: ZkLoginSession) => {
    setEphemeralKeyPair(session.ephemeralKeyPair)
    setZkProof(session.zkProof)
    setMaxEpoch(session.maxEpoch)
    setUserSalt(session.userSalt)
  }, [setEphemeralKeyPair, setZkProof, setMaxEpoch])

  // Clear all session data
  const clearSession = useCallback(() => {
    clearEphemeralKeyPair()
    clearZkProof()
    clearMaxEpoch()
    clearHasUserSalt()
    setUserSalt('') // Clear in-memory salt
  }, [clearEphemeralKeyPair, clearZkProof, clearMaxEpoch, clearHasUserSalt])

  // Check if session is valid
  const isValid = useCallback((): boolean => {
    return !!(ephemeralKeyPair && zkProof && maxEpoch && userSalt)
  }, [ephemeralKeyPair, zkProof, maxEpoch, userSalt])

  // Check if user has salt set up (using boolean flag)
  const hasSalt = useCallback((): boolean => {
    return hasUserSalt
  }, [hasUserSalt])

  // Set user salt (in memory only) and mark as set
  const setUserSaltValue = useCallback((salt: string) => {
    setUserSalt(salt)
    setHasUserSalt(true)
  }, [])

  // Clear user salt
  const clearUserSaltValue = useCallback(() => {
    setUserSalt('')
    clearHasUserSalt()
  }, [clearHasUserSalt])

  return {
    // Individual values
    ephemeralKeyPair,
    zkProof,
    maxEpoch,
    userSalt,
    hasUserSalt,
    
    // Individual setters
    setEphemeralKeyPair,
    setZkProof,
    setMaxEpoch,
    setUserSaltValue, // Use the new method for setting salt
    
    // Individual clearers
    clearEphemeralKeyPair,
    clearZkProof,
    clearMaxEpoch,
    clearUserSaltValue, // Use the new method for clearing salt
    
    // Session management
    getSession,
    setSession,
    clearSession,
    isValid,
    hasSalt
  }
}
