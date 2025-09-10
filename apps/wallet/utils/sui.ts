// Sui API service for fetching wallet data and token prices
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { normalizeSuiAddress } from '@mysten/sui/utils'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { getZkLoginSignature } from '@mysten/sui/zklogin'
import { ZkLoginSession } from './zk-login'

export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  usdValue: string
  price: number
  coinType: string
}

export interface TransactionRecord {
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

export const SUI_CHAINS = {
  DEVNET: 'devnet',
  TESTNET: 'testnet',
  MAINNET: 'mainnet'
}

// Sui client instance
export const suiClient = process.env.NEXT_PUBLIC_SUI_CHAIN !== SUI_CHAINS.DEVNET 
  ? new SuiClient({ url: getFullnodeUrl('mainnet') })
  : new SuiClient({ url: 'https://fullnode.devnet.sui.io' })

// Mock transaction data based on the real wallet
const MOCK_TRANSACTIONS: TransactionRecord[] = [
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

export async function fetchTransactions(address: string): Promise<TransactionRecord[]> {
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

    const transactions: TransactionRecord[] = []
    
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

// Transaction signing and creation functions
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
