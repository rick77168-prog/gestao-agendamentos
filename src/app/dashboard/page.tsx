"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/custom/navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, XCircle, DollarSign, Clock, TrendingUp, Users, Briefcase, AlertTriangle } from 'lucide-react'
import type { User, DashboardMetrics, Appointment } from '@/lib/types'

interface ExtendedMetrics extends DashboardMetrics {
  totalClients: number
  totalServices: number
  completionRate: number
  upcomingAppointments: Appointment[]
  recentNoShows: Appointment[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [metrics, setMetrics] = useState<ExtendedMetrics>({
    totalAppointments: 0,
    totalNoShows: 0,
    lostRevenue: 0,
    availableSlots: 0,
    totalClients: 0,
    totalServices: 0,
    completionRate: 0,
    upcomingAppointments: [],
    recentNoShows: []
  })
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/')
      return
    }
    setUser(JSON.parse(userData))
  }, [router])

  useEffect(() => {
    if (!user) return
    fetchMetrics()
  }, [user, dateRange])

  const getDateRange = () => {
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)

    if (dateRange === 'week') {
      start.setDate(start.getDate() - start.getDay())
      end.setDate(start.getDate() + 6)
    } else if (dateRange === 'month') {
      start.setDate(1)
      end.setMonth(end.getMonth() + 1, 0)
    }

    return { start, end }
  }

  const fetchMetrics = async () => {
    if (!user) return

    try {
      const { start, end } = getDateRange()

      // Buscar agendamentos do período
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*, services(*), clients(*), users(*)')
        .eq('company_id', user.company_id)
        .gte('start_datetime', start.toISOString())
        .lte('start_datetime', end.toISOString())
        .order('start_datetime', { ascending: true })

      if (appointmentsError) {
        console.error('Erro ao buscar agendamentos:', appointmentsError)
        // Continua mesmo com erro
      }

      // Buscar total de clientes com tratamento de erro
      let clientsCount = 0
      try {
        const { count, error: clientsError } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', user.company_id)

        if (clientsError) {
          console.error('Erro ao buscar clientes:', clientsError)
        } else {
          clientsCount = count || 0
        }
      } catch (err) {
        console.error('Erro ao buscar clientes:', err)
      }

      // Buscar total de serviços ativos com tratamento de erro
      let servicesCount = 0
      try {
        const { count, error: servicesError } = await supabase
          .from('services')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', user.company_id)
          .eq('active', true)

        if (servicesError) {
          console.error('Erro ao buscar serviços:', servicesError)
        } else {
          servicesCount = count || 0
        }
      } catch (err) {
        console.error('Erro ao buscar serviços:', err)
      }

      // Buscar próximos agendamentos (próximas 24h) com tratamento de erro
      let upcoming: any[] = []
      try {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(23, 59, 59, 999)

        const { data, error: upcomingError } = await supabase
          .from('appointments')
          .select('*, services(*), clients(*), users(*)')
          .eq('company_id', user.company_id)
          .gte('start_datetime', new Date().toISOString())
          .lte('start_datetime', tomorrow.toISOString())
          .in('status', ['scheduled', 'confirmed'])
          .order('start_datetime', { ascending: true })
          .limit(5)

        if (upcomingError) {
          console.error('Erro ao buscar próximos agendamentos:', upcomingError)
        } else {
          upcoming = data || []
        }
      } catch (err) {
        console.error('Erro ao buscar próximos agendamentos:', err)
      }

      // Calcular métricas
      const totalAppointments = appointments?.length || 0
      const noShows = appointments?.filter(a => a.status === 'no_show') || []
      const completed = appointments?.filter(a => a.status === 'completed') || []
      const totalNoShows = noShows.length
      const lostRevenue = noShows.reduce((sum, a) => sum + Number(a.price_snapshot || 0), 0)
      const completionRate = totalAppointments > 0 ? (completed.length / totalAppointments) * 100 : 0

      // Calcular horários vagos (10 slots por dia * dias no período)
      const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const totalSlots = daysInRange * 10
      const availableSlots = Math.max(0, totalSlots - totalAppointments)

      setMetrics({
        totalAppointments,
        totalNoShows,
        lostRevenue,
        availableSlots,
        totalClients: clientsCount,
        totalServices: servicesCount,
        completionRate,
        upcomingAppointments: upcoming,
        recentNoShows: noShows.slice(-5).reverse()
      })
    } catch (error) {
      console.error('Erro geral ao buscar métricas:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime)
    return {
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Visão geral do seu negócio
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setDateRange('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setDateRange('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setDateRange('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Mês
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                    Agendamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {metrics.totalAppointments}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {dateRange === 'today' ? 'Hoje' : dateRange === 'week' ? 'Esta semana' : 'Este mês'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <XCircle className="w-4 h-4 mr-2 text-red-500" />
                    Faltas (No-Show)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {metrics.totalNoShows}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {metrics.totalAppointments > 0 
                      ? `${((metrics.totalNoShows / metrics.totalAppointments) * 100).toFixed(1)}% do total`
                      : 'Nenhuma falta'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-orange-500" />
                    Receita Perdida
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    R$ {metrics.lostRevenue.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Por faltas de clientes
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                    Taxa de Conclusão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {metrics.completionRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Agendamentos concluídos
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <Users className="w-4 h-4 mr-2 text-purple-500" />
                    Total de Clientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {metrics.totalClients}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Clientes cadastrados
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-cyan-500 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <Briefcase className="w-4 h-4 mr-2 text-cyan-500" />
                    Serviços Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {metrics.totalServices}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Serviços disponíveis
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-indigo-500 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-indigo-500" />
                    Horários Vagos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    {metrics.availableSlots}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Slots disponíveis
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                    Próximos Agendamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.upcomingAppointments.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Nenhum agendamento próximo
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {metrics.upcomingAppointments.map((apt) => {
                        const { date, time } = formatDateTime(apt.start_datetime)
                        return (
                          <div key={apt.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {apt.clients?.name || 'Cliente'}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {apt.services?.name || 'Serviço'} • {apt.users?.name || 'Profissional'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {date}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {time}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                    Faltas Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.recentNoShows.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Nenhuma falta registrada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {metrics.recentNoShows.map((apt) => {
                        const { date, time } = formatDateTime(apt.start_datetime)
                        return (
                          <div key={apt.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {apt.clients?.name || 'Cliente'}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {apt.services?.name || 'Serviço'} • R$ {Number(apt.price_snapshot || 0).toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {date}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {time}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Próximos Passos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Cadastre seus clientes</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Acesse a seção Clientes para adicionar seus clientes</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Configure seus serviços</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Defina os serviços oferecidos e seus preços</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Adicione profissionais</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cadastre os profissionais da sua equipe</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Comece a agendar</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Use a Agenda para criar novos agendamentos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
