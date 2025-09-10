'use client'

import { Badge } from '@repo/ui/badge'

export function DevnetBanner() {
  return (
    <div className="fixed top-4 right-4 z-50">
      <Badge variant="destructive" className="px-3 py-1 text-xs font-medium">
        DEVNET
      </Badge>
    </div>
  )
}
