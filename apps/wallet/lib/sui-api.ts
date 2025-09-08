// Sui API service for fetching wallet data and token prices
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { normalizeSuiAddress } from '@mysten/sui/utils'

export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  usdValue: string
  price: number
  coinType: string
}

export interface Transaction {
  id: string
  type: 'send' | 'receive'
  amount: string
  symbol: string
  to?: string
  from?: string
  status: 'completed' | 'pending' | 'failed'
  timestamp: string
  hash: string
  gasFee?: string
}

// Sui client instance
const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') })

// Token metadata mapping
const TOKEN_METADATA: { [key: string]: { symbol: string; name: string; decimals: number } } = {
  '0x2::sui::SUI': { symbol: 'SUI', name: 'Sui', decimals: 9 },
  '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  '0xaf8cd5edc19c4512f4259f0bee101a40d41eb83173818fbd0dbea56b6f4a8bf5::coin::COIN': { symbol: 'WETH', name: 'Wrapped Ethereum', decimals: 8 },
}

// Price data - in production, this would fetch from CoinGecko, Sui price API, etc.
const MOCK_PRICES: { [key: string]: number } = {
  'SUI': 2.45,
  'USDC': 1.00,
  'USDT': 1.00,
  'WETH': 2500.00,
  'BTC': 45000.00
}

// Mock transaction data based on the real wallet
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'receive',
    amount: '100.0',
    symbol: 'SUI',
    from: '0x1234...5678',
    status: 'completed',
    timestamp: '2 hours ago',
    hash: '0xabcd...efgh',
    gasFee: '0.001 SUI'
  },
  {
    id: '2',
    type: 'send',
    amount: '50.0',
    symbol: 'SUI',
    to: '0x9876...5432',
    status: 'completed',
    timestamp: '1 day ago',
    hash: '0xijkl...mnop',
    gasFee: '0.001 SUI'
  },
  {
    id: '3',
    type: 'receive',
    amount: '25.0',
    symbol: 'USDC',
    from: '0x1111...2222',
    status: 'completed',
    timestamp: '3 days ago',
    hash: '0xqrst...uvwx',
    gasFee: '0.001 SUI'
  },
  {
    id: '4',
    type: 'send',
    amount: '10.0',
    symbol: 'SUI',
    to: '0x3333...4444',
    status: 'pending',
    timestamp: '5 hours ago',
    hash: '0xyzaa...bbcc',
    gasFee: '0.001 SUI'
  }
]

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

export async function fetchTransactions(address: string): Promise<Transaction[]> {
  try {
    const normalizedAddress = normalizeSuiAddress(address)
    
    // Get transaction history for the address (both sent and received)
    const [sentTxns, receivedTxns] = await Promise.all([
      suiClient.queryTransactionBlocks({
        filter: {
          FromAddress: normalizedAddress,
        },
        options: {
          showEffects: true,
          showInput: true,
          showEvents: true,
        },
        limit: 10,
        order: 'descending'
      }),
      suiClient.queryTransactionBlocks({
        filter: {
          ToAddress: normalizedAddress,
        },
        options: {
          showEffects: true,
          showInput: true,
          showEvents: true,
        },
        limit: 10,
        order: 'descending'
      })
    ])

    const transactions: Transaction[] = []
    
    // Process sent transactions
    for (const txn of sentTxns.data) {
      const effects = txn.effects
      const status = effects?.status?.status === 'success' ? 'completed' : 'failed'
      const timestamp = new Date(Number(txn.timestampMs || 0)).toLocaleString()
      
      // Extract amount from transaction effects
      const gasUsed = effects?.gasUsed?.computationCost || '0'
      const amount = '0' // This would need more complex parsing to extract actual transfer amounts
      
      transactions.push({
        id: txn.digest,
        type: 'send',
        amount: amount,
        symbol: 'SUI',
        status: status as 'completed' | 'pending' | 'failed',
        timestamp,
        hash: txn.digest,
        gasFee: gasUsed,
        to: 'Unknown', // Would need to parse from transaction
        from: normalizedAddress
      })
    }
    
    // Process received transactions
    for (const txn of receivedTxns.data) {
      const effects = txn.effects
      const status = effects?.status?.status === 'success' ? 'completed' : 'failed'
      const timestamp = new Date(Number(txn.timestampMs || 0)).toLocaleString()
      
      transactions.push({
        id: txn.digest,
        type: 'receive',
        amount: '0', // Would need to parse from transaction
        symbol: 'SUI',
        status: status as 'completed' | 'pending' | 'failed',
        timestamp,
        hash: txn.digest,
        gasFee: '0', // No gas fee for received transactions
        from: 'Unknown', // Would need to parse from transaction
        to: normalizedAddress
      })
    }
    
    // Sort by timestamp (newest first) and limit to 20
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    return transactions.slice(0, 20)
  } catch (error) {
    console.error('Failed to fetch transactions:', error)
    // Return mock data on error for now
    return MOCK_TRANSACTIONS
  }
}

export async function fetchTokenPrice(symbol: string): Promise<number> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // In production, this would call CoinGecko API or similar
  return MOCK_PRICES[symbol.toUpperCase()] || 0
}

export function calculateTotalValue(balances: TokenBalance[]): number {
  return balances.reduce((total, token) => total + parseFloat(token.usdValue), 0)
}
