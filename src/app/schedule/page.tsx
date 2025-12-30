"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/custom/navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Clock, User, Briefcase, CheckCircle, XCircle, AlertCircle, Filter, Search } from 'lucide-react'
import type { User as UserType, Client, Service, Appointment } from '@/lib/types'

export default function SchedulePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])]
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  
  const [formData, setFormData] = useState({
    client_id: '',
    service_id: '',
    staff_id: '',
    date: '',
    time: '',
    notes: ''
  })

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))
  }, [router])

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user])

  useEffect(() => {
    filterAppointments()
  }, [appointments, searchTerm, statusFilter, dateFilter])

  const filterAppointments = () => {
    let filtered = [...appointments]

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(apt => 
        apt.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.services?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.users?.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro de status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter)
    }

    // Filtro de data
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.setHours(0, 0, 0, 0))
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() + 7)

      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.start_datetime)
        
        if (dateFilter === 'today') {
          return aptDate >= today && aptDate < tomorrow
        } else if (dateFilter === 'tomorrow') {
          return aptDate >= tomorrow && aptDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
        } else if (dateFilter === 'week') {
          return aptDate >= today && aptDate < weekEnd
        }
        return true
      })
    }

    setFilteredAppointments(filtered)
  }

  const fetchData = async () => {
    if (!user) return
    
    try {
      const [appointmentsRes, clientsRes, servicesRes, staffRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, clients(*), services(*), users(*)')
          .eq('company_id', user.company_id)
          .order('start_datetime', { ascending: true }),
        supabase
          .from('clients')
          .select('*')
          .eq('company_id', user.company_id)
          .order('name', { ascending: true }),
        supabase
          .from('services')
          .select('*')
          .eq('company_id', user.company_id)
          .eq('active', true)
          .order('name', { ascending: true }),
        supabase
          .from('users')
          .select('*')
          .eq('company_id', user.company_id)
          .eq('active', true)
          .order('name', { ascending: true })
      ])

      if (appointmentsRes.error) throw appointmentsRes.error
      if (clientsRes.error) throw clientsRes.error
      if (servicesRes.error) throw servicesRes.error
      if (staffRes.error) throw staffRes.error

      setAppointments(appointmentsRes.data || [])
      setClients(clientsRes.data || [])
      setServices(servicesRes.data || [])
      setStaff(staffRes.data || [])
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const service = services.find(s => s.id === formData.service_id)
      if (!service) return

      const startDatetime = new Date(`${formData.date}T${formData.time}`)
      const endDatetime = new Date(startDatetime.getTime() + service.duration_minutes * 60000)

      // Verificar conflitos de horário
      const { data: conflicts } = await supabase
        .from('appointments')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('staff_id', formData.staff_id)
        .gte('start_datetime', startDatetime.toISOString())
        .lt('start_datetime', endDatetime.toISOString())
        .neq('status', 'canceled')

      if (conflicts && conflicts.length > 0) {
        alert('Já existe um agendamento neste horário para este profissional!')
        return
      }

      const { error } = await supabase
        .from('appointments')
        .insert([{
          company_id: user.company_id,
          client_id: formData.client_id,
          service_id: formData.service_id,
          staff_id: formData.staff_id,
          start_datetime: startDatetime.toISOString(),
          end_datetime: endDatetime.toISOString(),
          status: 'scheduled',
          price_snapshot: service.price
        }])

      if (error) throw error

      setFormData({ client_id: '', service_id: '', staff_id: '', date: '', time: '', notes: '' })
      setDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Erro ao criar agendamento:', error)
      alert('Erro ao criar agendamento. Tente novamente.')
    }
  }

  const updateStatus = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      case 'confirmed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      case 'completed': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      case 'canceled': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
      case 'no_show': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado'
      case 'confirmed': return 'Confirmado'
      case 'completed': return 'Concluído'
      case 'canceled': return 'Cancelado'
      case 'no_show': return 'Faltou'
      default: return status
    }
  }

  const groupAppointmentsByDate = (appointments: Appointment[]) => {
    const grouped: { [key: string]: Appointment[] } = {}
    
    appointments.forEach(apt => {
      const date = new Date(apt.start_datetime).toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(apt)
    })
    
    return grouped
  }

  if (!user) return null

  const groupedAppointments = groupAppointmentsByDate(filteredAppointments)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agenda</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gerencie seus agendamentos
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Agendamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Serviço *</Label>
                  <Select value={formData.service_id} onValueChange={(value) => setFormData({ ...formData, service_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(service => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - R$ {Number(service.price).toFixed(2)} ({service.duration_minutes}min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Profissional *</Label>
                  <Select value={formData.staff_id} onValueChange={(value) => setFormData({ ...formData, staff_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Hora *</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Criar Agendamento
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center">
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Label>
                <Input
                  placeholder="Cliente, serviço ou profissional..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center">
                  <Filter className="w-4 h-4 mr-2" />
                  Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="canceled">Cancelado</SelectItem>
                    <SelectItem value="no_show">Faltou</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Período
                </Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="tomorrow">Amanhã</SelectItem>
                    <SelectItem value="week">Próximos 7 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setDateFilter('all')
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {appointments.length === 0 
                  ? 'Nenhum agendamento cadastrado ainda'
                  : 'Nenhum agendamento encontrado com os filtros aplicados'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAppointments).map(([date, dayAppointments]) => (
              <div key={date}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 capitalize">
                  {date}
                </h2>
                <div className="space-y-4">
                  {dayAppointments.map((appointment) => (
                    <Card key={appointment.id} className="shadow-lg hover:shadow-xl transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="flex items-center text-lg">
                            <User className="w-5 h-5 mr-2 text-blue-500" />
                            {appointment.clients?.name}
                          </span>
                          <Badge className={getStatusColor(appointment.status)}>
                            {getStatusLabel(appointment.status)}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <Briefcase className="w-4 h-4 mr-2" />
                            {appointment.services?.name}
                          </div>
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4 mr-2" />
                            {appointment.users?.name}
                          </div>
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4 mr-2" />
                            {new Date(appointment.start_datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {new Date(appointment.end_datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center text-sm font-medium text-gray-900 dark:text-white">
                            R$ {Number(appointment.price_snapshot).toFixed(2)}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-4 border-t">
                          {appointment.status !== 'confirmed' && appointment.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(appointment.id, 'confirmed')}
                              className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirmar
                            </Button>
                          )}
                          {appointment.status !== 'completed' && appointment.status !== 'canceled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(appointment.id, 'completed')}
                              className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Concluir
                            </Button>
                          )}
                          {appointment.status !== 'no_show' && appointment.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(appointment.id, 'no_show')}
                              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Faltou
                            </Button>
                          )}
                          {appointment.status !== 'canceled' && appointment.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(appointment.id, 'canceled')}
                              className="text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                            >
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
