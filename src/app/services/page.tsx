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
import { Plus, Clock, DollarSign, Calendar, Briefcase } from 'lucide-react'
import type { User, Service } from '@/lib/types'

export default function ServicesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    duration_minutes: '',
    price: '',
    return_interval_days: ''
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
    fetchServices()
  }, [user])

  const fetchServices = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('Erro ao buscar serviços:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const { error } = await supabase
        .from('services')
        .insert([{
          company_id: user.company_id,
          name: formData.name,
          duration_minutes: parseInt(formData.duration_minutes),
          price: parseFloat(formData.price),
          return_interval_days: formData.return_interval_days ? parseInt(formData.return_interval_days) : null,
          active: true
        }])

      if (error) throw error

      setFormData({ name: '', duration_minutes: '', price: '', return_interval_days: '' })
      setDialogOpen(false)
      fetchServices()
    } catch (error) {
      console.error('Erro ao criar serviço:', error)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Serviços</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gerencie os serviços oferecidos
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Serviço</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Serviço *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Corte de Cabelo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duração (minutos) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="60"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="50.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return_interval">Intervalo de Retorno (dias)</Label>
                  <Input
                    id="return_interval"
                    type="number"
                    placeholder="30"
                    value={formData.return_interval_days}
                    onChange={(e) => setFormData({ ...formData, return_interval_days: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">Sugestão de retorno do cliente</p>
                </div>
                <Button type="submit" className="w-full">
                  Salvar Serviço
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : services.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Nenhum serviço cadastrado ainda
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Briefcase className="w-5 h-5 mr-2 text-blue-500" />
                    {service.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-2" />
                      Duração
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {service.duration_minutes} min
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-gray-600 dark:text-gray-400">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Preço
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400 text-lg">
                      R$ {Number(service.price).toFixed(2)}
                    </span>
                  </div>
                  {service.return_interval_days && (
                    <div className="flex items-center justify-between text-sm pt-3 border-t">
                      <span className="flex items-center text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4 mr-2" />
                        Retorno sugerido
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {service.return_interval_days} dias
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
