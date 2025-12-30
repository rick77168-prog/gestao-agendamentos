export type UserRole = 'super_admin' | 'owner' | 'staff'
export type CompanyStatus = 'active' | 'inactive'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'canceled' | 'no_show' | 'completed'

export interface Company {
  id: string
  name: string
  business_type: string
  status: CompanyStatus
  created_at: string
}

export interface User {
  id: string
  company_id: string
  name: string
  email: string
  password: string
  role: UserRole
  active: boolean
  created_at?: string
  companies?: Company
}

export interface Client {
  id: string
  company_id: string
  name: string
  phone?: string
  email?: string
  notes?: string
  created_at: string
}

export interface Service {
  id: string
  company_id: string
  name: string
  duration_minutes: number
  price: number
  return_interval_days?: number
  active: boolean
  created_at?: string
}

export interface Appointment {
  id: string
  company_id: string
  service_id: string
  staff_id: string
  client_id: string
  start_datetime: string
  end_datetime: string
  status: AppointmentStatus
  price_snapshot: number
  created_at: string
  services?: Service
  clients?: Client
  users?: User
}

export interface Waitlist {
  id: string
  company_id: string
  service_id: string
  client_id: string
  created_at: string
}

export interface DashboardMetrics {
  totalAppointments: number
  totalNoShows: number
  lostRevenue: number
  availableSlots: number
}
