import { createClient } from '@supabase/supabase-js'

// Usar variáveis de ambiente do lado do cliente (NEXT_PUBLIC_)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validar se as variáveis estão configuradas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Variáveis de ambiente do Supabase não configuradas!')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Configurada' : '✗ Faltando')
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Configurada' : '✗ Faltando')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Helper para pegar usuário logado
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('Erro ao buscar usuário:', error)
      return null
    }
    return user
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return null
  }
}

// Helper para pegar dados do usuário (com company_id e role)
export async function getUserData(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, companies(*)')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Erro ao buscar dados do usuário:', error)
      throw error
    }
    return data
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error)
    throw error
  }
}
