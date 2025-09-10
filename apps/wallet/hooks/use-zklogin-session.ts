'use client'

import { useCallback, useState } from 'react'
import {
  useSessionStorage,
  useSessionStorageString,
  useSessionStorageNumber,
  useSessionStorageBoolean
} from '@/hooks/use-session-storage'

interface ZkLoginSession {
  ephemeralKeyPair: string
  zkProof: any
  maxEpoch: number
}

/**
 * Custom hook for managing zkLogin session data
 * Provides safe access to all zkLogin-related sessionStorage values
 */
export function useZkLoginSession() {
  const [ephemeralKeyPair, setEphemeralKeyPair, clearEphemeralKeyPair] = useSessionStorageString('ephemeralKeyPair', '')
  const [zkProof, setZkProof, clearZkProof] = useSessionStorage('zkProof', null)
  const [maxEpoch, setMaxEpoch, clearMaxEpoch] = useSessionStorageNumber('maxEpoch', 0)

  // Get complete session data
  const getSession = useCallback((): ZkLoginSession | null => {
    if (!ephemeralKeyPair || !zkProof || !maxEpoch) {
      return null
    }

    return {
      ephemeralKeyPair,
      zkProof,
      maxEpoch
    }
  }, [ephemeralKeyPair, zkProof, maxEpoch])

  // Set complete session data
  const setSession = useCallback((session: ZkLoginSession) => {
    setEphemeralKeyPair(session.ephemeralKeyPair)
    setZkProof(session.zkProof)
    setMaxEpoch(session.maxEpoch)
  }, [setEphemeralKeyPair, setZkProof, setMaxEpoch])

  // Clear all session data
  const clearSession = useCallback(() => {
    clearEphemeralKeyPair()
    clearZkProof()
    clearMaxEpoch()
  }, [clearEphemeralKeyPair, clearZkProof, clearMaxEpoch])

  // Check if session is valid
  const isValid = useCallback((): boolean => {
    return !!(ephemeralKeyPair && zkProof && maxEpoch)
  }, [ephemeralKeyPair, zkProof, maxEpoch])

  return {
    // Individual values
    ephemeralKeyPair,
    zkProof,
    maxEpoch,
    
    // Individual setters
    setEphemeralKeyPair,
    setZkProof,
    setMaxEpoch,
    
    // Individual clearers
    clearEphemeralKeyPair,
    clearZkProof,
    clearMaxEpoch,
    
    // Session management
    getSession,
    setSession,
    clearSession,
    isValid
  }
}
