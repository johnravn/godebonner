import { vi } from 'vitest'

type RpcResult = { data: unknown; error: { message: string } | null }

/**
 * Minimal Supabase stub for component tests that call `getSupabase().rpc(...)`.
 */
export function createRpcMock(handlers: Record<string, (args: Record<string, unknown>) => RpcResult | Promise<RpcResult>>) {
  return {
    rpc: vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
      const handler = handlers[name]
      if (!handler) {
        return { data: null, error: { message: `Unhandled RPC: ${name}` } }
      }
      return handler(args)
    }),
    from: vi.fn(() => {
      throw new Error('Unexpected .from() in this test — add a stub if needed')
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  }
}
