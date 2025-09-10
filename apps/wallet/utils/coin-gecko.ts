import { TokenBalance, suiClient } from './sui'
import { normalizeSuiAddress } from '@mysten/sui/utils'

// Price data - in production, this would fetch from CoinGecko, Sui price API, etc.
const MOCK_PRICES: { [key: string]: number } = {
  'SUI': 2.45,
  'USDC': 1.00,
  'USDT': 1.00,
  'WETH': 2500.00,
  'BTC': 45000.00
}

// Token metadata mapping
const TOKEN_METADATA: { [key: string]: { symbol: string; name: string; decimals: number } } = {
  '0x2::sui::SUI': { symbol: 'SUI', name: 'Sui', decimals: 9 },
  '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  '0xaf8cd5edc19c4512f4259f0bee101a40d41eb83173818fbd0dbea56b6f4a8bf5::coin::COIN': { symbol: 'WETH', name: 'Wrapped Ethereum', decimals: 8 },
}

export async function fetchTokenPrice(symbol: string): Promise<number> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // In production, this would call CoinGecko API or similar
  return MOCK_PRICES[symbol.toUpperCase()] || 0
}

export async function fetchTokenBalances(address: string): Promise<TokenBalance[]> {
  try {
    const normalizedAddress = normalizeSuiAddress(address)
    
    // Get all coin objects for the address
    const coinObjects = await suiClient.getCoins({
      owner: normalizedAddress,
    })

    // Group coins by coin type
    const coinMap = new Map<string, { totalBalance: bigint; coinType: string }>()
    
    for (const coin of coinObjects.data) {
      const coinType = coin.coinType
      const balance = BigInt(coin.balance)
      
      if (coinMap.has(coinType)) {
        const existing = coinMap.get(coinType)!
        existing.totalBalance += balance
      } else {
        coinMap.set(coinType, { totalBalance: balance, coinType })
      }
    }

    // Convert to TokenBalance format
    const balances: TokenBalance[] = []
    
    for (const [coinType, { totalBalance }] of coinMap) {
      const metadata = TOKEN_METADATA[coinType]
      
      if (metadata) {
        // Known token with metadata
        const decimals = metadata.decimals
        const balance = Number(totalBalance) / Math.pow(10, decimals)
        const price = MOCK_PRICES[metadata.symbol] || 0
        const usdValue = (balance * price).toFixed(2)
        
        balances.push({
          symbol: metadata.symbol,
          name: metadata.name,
          balance: balance.toFixed(6),
          price,
          usdValue,
          coinType
        })
      } else {
        // Unknown token - show with basic info
        const balance = Number(totalBalance) / Math.pow(10, 9) // Default to 9 decimals
        const symbol = coinType.split('::').pop() || 'UNKNOWN'
        const name = `Unknown ${symbol}`
        
        balances.push({
          symbol: symbol,
          name: name,
          balance: balance.toFixed(6),
          price: 0,
          usdValue: '0.00',
          coinType
        })
      }
    }

    // Sort by USD value (highest first)
    balances.sort((a, b) => parseFloat(b.usdValue) - parseFloat(a.usdValue))
    
    return balances
  } catch (error) {
    console.error('Failed to fetch token balances:', error)
    // Return empty array on error
    return []
  }
}