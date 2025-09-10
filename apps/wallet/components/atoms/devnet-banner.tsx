'use client'

import { Badge } from '@repo/ui/badge'
import { SUI_CHAINS } from '@/utils/sui'

export function DevnetBanner() {
  // Only show banner when SUI_CHAIN is set to 'devnet'
  const suiChain = process.env.NEXT_PUBLIC_SUI_CHAIN

  if (suiChain !== SUI_CHAINS.DEVNET) {
    return null
  }

  return (
    <div className="fixed top-2 right-2 z-50">
      <Badge variant="destructive" className="px-3 py-1 rounded-full text-xs font-medium bg-red-600 text-white border-red-600 uppercase">
        devnet
      </Badge>
    </div>
  )
}
