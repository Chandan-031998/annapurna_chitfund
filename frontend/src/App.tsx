import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  FiActivity,
  FiBarChart2,
  FiBookOpen,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiEdit2,
  FiEye,
  FiHome,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiSend,
  FiShield,
  FiSun,
  FiTrash2,
  FiTrendingUp,
  FiUsers,
  FiX
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { useAuth } from './hooks/useAuth'
import { loginUser, logout, registerUser } from './redux/slices/authSlice'
import { api, getData, postData } from './services/api'
import type { Role } from './types/auth.types'

type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'PAID' | 'PARTIAL' | 'COMPLETED'
type LedgerType = 'CREDIT' | 'DEBIT'

interface Member {
  id: number
  memberCode: string
  name: string
  email?: string
  phone: string
  address?: string
  aadhaarNumber?: string
  photo?: string
  groupId?: number
  status: Status
  joinedAt?: string
}

interface ChitGroup {
  id: number
  code: string
  name: string
  monthlyAmount: number
  totalMembers: number
  durationMonths: number
  status: Status
  startDate: string
  members: Pick<Member, 'id' | 'name' | 'phone'>[]
}

interface Collection {
  id: number
  month: number
  year: number
  amount: number
  paidAmount: number
  status: Status
  paymentMode?: string
  receiptNo?: string
  notes?: string
  member?: Member
  group?: ChitGroup
}

interface Auction {
  id: number
  winnerMemberId?: number
  winnerName: string
  winningAmount: number
  discount: number
  auctionDate: string
  notes?: string
  group?: ChitGroup
}

interface LedgerEntry {
  id: number
  type: LedgerType
  title: string
  amount: number
  entryDate: string
  runningBalance?: number
  notes?: string
}

interface Expense {
  id: number
  title: string
  category: string
  amount: number
  expenseDate: string
  paymentMode?: string
  notes?: string
}

interface NotificationItem {
  id: number
  title: string
  message: string
  sentTo: string
  status: Status
  createdAt: string
}

interface ReportData {
  summary: {
    members: number
    groups: number
    activeGroups: number
    totalCollected: number
    pendingAmount: number
    totalExpenses: number
    totalAuctionValue: number
    ledgerBalance: number
    profit: number
  }
  monthlyCollections: { month: number; paid: number; due: number }[]
  auctionTrends: { month: string; bidAmount: number; prizeAmount: number }[]
  paymentStatus: { name: string; value: number }[]
  expenseByCategory: { category: string; amount: number }[]
  pendingPayments: Collection[]
  recentCollections: Collection[]
}

interface NavItem {
  to: string
  label: string
  icon: IconType
  roles?: Role[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: FiHome },
  { to: '/members', label: 'Members', icon: FiUsers },
  { to: '/groups', label: 'Chit Groups', icon: FiActivity },
  { to: '/collections', label: 'Collections', icon: FiCreditCard },
  { to: '/auctions', label: 'Auctions', icon: FiTrendingUp, roles: ['ADMIN', 'ACCOUNTANT'] },
  { to: '/ledger', label: 'Ledger', icon: FiBookOpen, roles: ['ADMIN', 'ACCOUNTANT'] },
  { to: '/expenses', label: 'Expenses', icon: FiDollarSign, roles: ['ADMIN', 'ACCOUNTANT'] },
  { to: '/reports', label: 'Reports', icon: FiBarChart2 },
  { to: '/notifications', label: 'Notifications', icon: FiSend }
]

const pieColors = ['#0f8fd2', '#f59e0b', '#64748b', '#ef4444']
const money = (value: number | string | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const today = () => new Date().toISOString().slice(0, 10)
const monthNow = () => new Date().getMonth() + 1

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/*" element={<Protected><Shell /></Protected>} />
      </Routes>
    </BrowserRouter>
  )
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Record<string, string>>()
  const { dispatch, loading, token } = useAuth()
  const navigate = useNavigate()
  const clearedInitialSession = useRef(false)

  useEffect(() => {
    if (!clearedInitialSession.current) {
      clearedInitialSession.current = true
      if (token) {
        toast.dismiss()
        dispatch(logout())
      }
    }
  }, [dispatch, token])

  const submit = handleSubmit(async (values) => {
    try {
      if (mode === 'login') {
        await dispatch(loginUser({ email: values.email, password: values.password })).unwrap()
        toast.success('Login successful')
      } else {
        await dispatch(registerUser({
          name: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password,
          role: values.role || 'MEMBER'
        })).unwrap()
        toast.success('Account created')
      }
      navigate(mode === 'login' ? '/dashboard' : '/')
    } catch (error) {
      toast.error(mode === 'login' ? 'Authentication failed' : apiError(error))
    }
  })

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-amber-50 text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <section>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/70 px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm">
            <FiShield /> Secure finance operations
          </div>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight text-slate-950 sm:text-5xl">Annapurna Layout Chit Fund Management System</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">A production workspace for members, chit groups, collections, auctions, ledger, expenses, reminders and analytics.</p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {['JWT roles', 'MySQL records', 'Export reports'].map((item) => (
              <div key={item} className="rounded-lg border border-sky-100 bg-white/75 p-4 text-sm font-medium text-slate-700 shadow-sm">{item}</div>
            ))}
          </div>
        </section>
        <form onSubmit={submit} className="rounded-2xl border border-white/80 bg-white/90 p-5 text-slate-950 shadow-glow backdrop-blur sm:p-6">
          <h2 className="text-2xl font-bold">{mode === 'login' ? 'Login' : 'Create account'}</h2>
          <p className="mt-1 text-sm text-slate-500">{mode === 'login' ? 'Use your registered email and password.' : 'Create an operational user with the correct role.'}</p>
          {mode === 'register' && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name?.message}>
                <input className="input" {...register('name', { required: 'Name is required' })} />
              </Field>
              <Field label="Phone">
                <input className="input" {...register('phone')} />
              </Field>
            </div>
          )}
          <div className="mt-5 grid gap-4">
            <Field label="Email" error={errors.email?.message}>
              <input className="input" type="email" {...register('email', { required: 'Email is required' })} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <input className="input" type="password" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Use at least 6 characters' } })} />
            </Field>
            {mode === 'register' && (
              <Field label="Role">
                <select className="input" defaultValue="MEMBER" {...register('role')}>
                  <option value="ADMIN">Admin</option>
                  <option value="COLLECTOR">Collector</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="MEMBER">Member</option>
                </select>
              </Field>
            )}
          </div>
          <button disabled={loading} className="btn-primary mt-6 w-full">
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
          <NavLink className="mt-4 block text-center text-sm font-medium text-brand-700" to={mode === 'login' ? '/register' : '/login'}>
            {mode === 'login' ? 'Create a new account' : 'Already have an account? Login'}
          </NavLink>
        </form>
      </div>
    </main>
  )
}

function Shell() {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(localStorage.getItem('annapurna_theme') === 'dark')
  const { user, dispatch } = useAuth()
  const navigate = useNavigate()
  const visibleNav = navItems.filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)))

  useEffect(() => {
    localStorage.setItem('annapurna_theme', dark ? 'dark' : 'light')
  }, [dark])

  const signOut = () => {
    dispatch(logout())
    toast.success('Logged out')
    navigate('/login')
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-amber-50 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
        {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-40 w-[min(18rem,86vw)] border-r border-white/20 bg-gradient-to-b from-brand-800 via-brand-700 to-sky-700 px-4 py-5 text-white shadow-2xl transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-100">Annapurna</p>
              <h2 className="text-lg font-bold">Chit Fund</h2>
            </div>
            <button className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)}><FiX /></button>
          </div>
          <nav className="mt-8 space-y-1">
            {visibleNav.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-white text-brand-800 shadow-lg shadow-sky-950/10' : 'text-sky-50/90 hover:bg-white/10 hover:text-white'}`}>
                  <Icon /> {item.label}
                </NavLink>
              )
            })}
          </nav>
        </aside>
        <main className="lg:pl-72">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75 sm:px-6">
            <button className="rounded-lg border border-sky-100 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:hidden" onClick={() => setOpen(true)}><FiMenu /></button>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back</p>
              <h1 className="truncate font-semibold">{user?.name || 'User'} <span className="text-xs font-medium text-brand-600 dark:text-sky-300">{user?.role}</span></h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IconButton label="Toggle theme" onClick={() => setDark((value) => !value)}>{dark ? <FiSun /> : <FiMoon />}</IconButton>
              <button onClick={signOut} className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-100 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                <FiLogOut /> <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/auctions" element={<AuctionsPage />} />
              <Route path="/ledger" element={<LedgerPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

function Dashboard() {
  const { data, loading, reload } = useResource<ReportData>('/reports')
  const summary = data?.summary
  const cards = [
    { label: 'Total Members', value: summary?.members || 0, icon: FiUsers },
    { label: 'Active Chit Groups', value: summary?.activeGroups || 0, icon: FiActivity },
    { label: 'Monthly Collections', value: money(summary?.totalCollected), icon: FiCreditCard },
    { label: 'Pending Payments', value: money(summary?.pendingAmount), icon: FiBarChart2 },
    { label: 'Expenses', value: money(summary?.totalExpenses), icon: FiDollarSign },
    { label: 'Profit Overview', value: money(summary?.profit), icon: FiTrendingUp }
  ]

  return (
    <Page title="Dashboard" action={<button onClick={reload} className="btn-secondary"><FiRefreshCcw /> Refresh</button>}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 break-words text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
              </div>
              <div className="shrink-0 rounded-lg bg-gradient-to-br from-brand-50 to-cyan-50 p-3 text-brand-700 shadow-sm dark:from-brand-600/20 dark:to-cyan-500/10 dark:text-sky-200"><Icon /></div>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card title="Monthly Collection Chart"><MonthlyChart data={data?.monthlyCollections || []} /></Card>
        <Card title="Payment Status"><StatusPie data={data?.paymentStatus || []} /></Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card title="Auction Trend"><AuctionTrend data={data?.auctionTrends || []} /></Card>
        <Card title="Recent Transactions">
          <DataTable rows={data?.recentCollections || []} columns={[
            ['member.name', 'Member'],
            ['group.name', 'Group'],
            ['paidAmount', 'Paid'],
            ['status', 'Status']
          ]} loading={loading} />
        </Card>
      </div>
    </Page>
  )
}

function MembersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Member | null>(null)
  const [viewing, setViewing] = useState<Member | null>(null)
  const query = `/members?search=${encodeURIComponent(search)}&page=${page}&limit=8`
  const { data, loading, reload } = useResource<{ items: Member[]; total: number; page: number; limit: number }>(query)
  const rows = useMemo(() => (data?.items || []).filter((member) => !status || member.status === status), [data, status])

  async function remove(member: Member) {
    if (!confirm(`Delete ${member.name}?`)) return
    await api.delete(`/members/${member.id}`)
    toast.success('Member deleted')
    reload()
  }

  return (
    <Page title="Members Management" action={<SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1) }} />}>
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card title={editing ? 'Edit Member' : 'Add Member'}>
          <MemberForm value={editing} onSaved={() => { setEditing(null); reload() }} />
        </Card>
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select className="input max-w-44" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <span className="text-sm text-slate-500">{data?.total || 0} members</span>
          </div>
          <DataTable rows={rows} loading={loading} columns={[
            ['memberCode', 'Code'],
            ['photo', 'Image'],
            ['name', 'Name'],
            ['phone', 'Phone'],
            ['status', 'Status'],
            ['actions', 'Actions']
          ]} render={(row, key) => {
            const member = row as Member
            if (key === 'photo') return <Avatar member={member} />
            if (key === 'status') return <Badge label={member.status} />
            if (key === 'actions') return <RowActions onView={() => setViewing(member)} onEdit={() => setEditing(member)} onDelete={() => remove(member)} />
            return formatCell(readPath(row, key))
          }} />
          <Pagination page={page} total={data?.total || 0} limit={8} onPage={setPage} />
        </Card>
      </div>
      <Modal title="Member Details" open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing && <DetailList rows={[
          ['Code', viewing.memberCode],
          ['Name', viewing.name],
          ['Phone', viewing.phone],
          ['Email', viewing.email || '-'],
          ['Aadhaar', viewing.aadhaarNumber || '-'],
          ['Address', viewing.address || '-'],
          ['Status', viewing.status]
        ]} />}
      </Modal>
    </Page>
  )
}

function MemberForm({ value, onSaved }: { value: Member | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    memberCode: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    aadhaarNumber: '',
    photo: '',
    status: 'ACTIVE'
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      memberCode: value?.memberCode || `MEM-${Date.now().toString().slice(-5)}`,
      name: value?.name || '',
      phone: value?.phone || '',
      email: value?.email || '',
      address: value?.address || '',
      aadhaarNumber: value?.aadhaarNumber || '',
      photo: value?.photo || '',
      status: value?.status || 'ACTIVE'
    })
  }, [value])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      if (value) await api.put(`/members/${value.id}`, form)
      else await postData('/members', form)
      toast.success(value ? 'Member updated' : 'Member added')
      onSaved()
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        toast.error(apiError(error))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Member Code" value={form.memberCode} onChange={(memberCode) => setForm({ ...form, memberCode })} />
        <TextField label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
      </div>
      <TextField label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
      <TextField label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} required={false} />
      <TextField label="Aadhaar Number" value={form.aadhaarNumber} onChange={(aadhaarNumber) => setForm({ ...form, aadhaarNumber })} required={false} />
      <TextField label="Profile Image URL" value={form.photo} onChange={(photo) => setForm({ ...form, photo })} required={false} />
      <Field label="Status">
        <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </Field>
      <Field label="Address">
        <textarea className="input min-h-24" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
      </Field>
      <button disabled={saving} className="btn-primary">{saving ? 'Saving...' : value ? 'Update Member' : 'Add Member'}</button>
    </form>
  )
}

function GroupsPage() {
  const { data: groups, loading, reload } = useResource<ChitGroup[]>('/groups')
  const { data: members } = useResource<{ items: Member[] }>('/members?limit=100')
  const [editing, setEditing] = useState<ChitGroup | null>(null)
  const [viewing, setViewing] = useState<ChitGroup | null>(null)

  async function remove(group: ChitGroup) {
    if (!confirm(`Delete ${group.name}?`)) return
    await api.delete(`/groups/${group.id}`)
    toast.success('Group deleted')
    reload()
  }

  return (
    <Page title="Chit Group Management">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card title={editing ? 'Edit Chit Group' : 'Create Chit Group'}>
          <GroupForm value={editing} members={members?.items || []} onSaved={() => { setEditing(null); reload() }} />
        </Card>
        <Card>
          <DataTable rows={groups || []} loading={loading} columns={[
            ['code', 'Code'],
            ['name', 'Group'],
            ['monthlyAmount', 'Monthly'],
            ['durationMonths', 'Duration'],
            ['status', 'Status'],
            ['actions', 'Actions']
          ]} render={(row, key) => {
            const group = row as ChitGroup
            if (key === 'status') return <Badge label={group.status} />
            if (key === 'actions') return <RowActions onView={() => setViewing(group)} onEdit={() => setEditing(group)} onDelete={() => remove(group)} />
            return formatCell(readPath(row, key))
          }} />
        </Card>
      </div>
      <Modal title="Group Details" open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="space-y-5">
            <DetailList rows={[
              ['Group', viewing.name],
              ['Monthly Amount', money(viewing.monthlyAmount)],
              ['Duration', `${viewing.durationMonths} months`],
              ['Members', `${viewing.members.length}/${viewing.totalMembers}`],
              ['Status', viewing.status]
            ]} />
            <div>
              <h4 className="mb-2 font-semibold">Assigned Members</h4>
              <div className="grid gap-2">
                {viewing.members.map((member) => <div key={member.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">{member.name} - {member.phone}</div>)}
                {!viewing.members.length && <Empty text="No members assigned." />}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}

function GroupForm({ value, members, onSaved }: { value: ChitGroup | null; members: Member[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '',
    monthlyAmount: 5000,
    totalMembers: 20,
    durationMonths: 20,
    startDate: today(),
    status: 'ACTIVE',
    memberIds: [] as number[]
  })

  useEffect(() => {
    setForm({
      name: value?.name || '',
      monthlyAmount: value?.monthlyAmount || 5000,
      totalMembers: value?.totalMembers || 20,
      durationMonths: value?.durationMonths || 20,
      startDate: value?.startDate ? String(value.startDate).slice(0, 10) : today(),
      status: value?.status || 'ACTIVE',
      memberIds: value?.members?.map((member) => member.id) || []
    })
  }, [value])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const payload = { ...form, monthlyAmount: Number(form.monthlyAmount), totalMembers: Number(form.totalMembers), durationMonths: Number(form.durationMonths) }
    if (value) await api.put(`/groups/${value.id}`, payload)
    else await postData('/groups', payload)
    toast.success(value ? 'Group updated' : 'Group created')
    onSaved()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <TextField label="Group Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
      <NumberField label="Monthly Amount" value={form.monthlyAmount} onChange={(monthlyAmount) => setForm({ ...form, monthlyAmount })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Total Members" value={form.totalMembers} onChange={(totalMembers) => setForm({ ...form, totalMembers })} />
        <NumberField label="Duration Months" value={form.durationMonths} onChange={(durationMonths) => setForm({ ...form, durationMonths })} />
      </div>
      <Field label="Start Date"><input className="input" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
      <Field label="Group Status">
        <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </Field>
      <Field label="Add Members">
        <select className="input min-h-36" multiple value={form.memberIds.map(String)} onChange={(event) => setForm({ ...form, memberIds: Array.from(event.target.selectedOptions).map((option) => Number(option.value)) })}>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name} - {member.phone}</option>)}
        </select>
      </Field>
      <button className="btn-primary">{value ? 'Update Group' : 'Create Group'}</button>
    </form>
  )
}

function CollectionsPage() {
  const { data: collections, loading, reload } = useResource<Collection[]>('/collections')
  const { data: members } = useResource<{ items: Member[] }>('/members?limit=100')
  const { data: groups } = useResource<ChitGroup[]>('/groups')

  return (
    <Page title="Collection Module">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card title="Monthly Payment Entry">
          <CollectionForm members={members?.items || []} groups={groups || []} onSaved={reload} />
        </Card>
        <div className="grid gap-6">
          <Card title="Pending Dues">
            <DataTable rows={(collections || []).filter((item) => item.status !== 'PAID')} columns={[
              ['member.name', 'Member'],
              ['group.name', 'Group'],
              ['amount', 'Due'],
              ['status', 'Status']
            ]} render={(row, key) => key === 'status' ? <Badge label={(row as Collection).status} /> : formatCell(readPath(row, key))} />
          </Card>
          <Card title="Collection History">
            <DataTable rows={collections || []} loading={loading} columns={[
              ['receiptNo', 'Receipt'],
              ['member.name', 'Member'],
              ['group.name', 'Group'],
              ['paidAmount', 'Paid'],
              ['paymentMode', 'Mode'],
              ['status', 'Status']
            ]} render={(row, key) => key === 'status' ? <Badge label={(row as Collection).status} /> : formatCell(readPath(row, key))} />
          </Card>
        </div>
      </div>
    </Page>
  )
}

function CollectionForm({ members, groups, onSaved }: { members: Member[]; groups: ChitGroup[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    memberId: '',
    groupId: '',
    month: monthNow(),
    year: new Date().getFullYear(),
    amount: 5000,
    paidAmount: 5000,
    paymentMode: 'cash',
    receiptNo: `RCPT-${Date.now().toString().slice(-6)}`,
    notes: ''
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    await postData('/collections', form)
    toast.success(`Receipt ${form.receiptNo} recorded`)
    setForm({ ...form, receiptNo: `RCPT-${Date.now().toString().slice(-6)}`, paidAmount: form.amount })
    onSaved()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <SelectField label="Member" value={form.memberId} onChange={(memberId) => setForm({ ...form, memberId })} options={members.map((member) => [member.id, member.name])} />
      <SelectField label="Group" value={form.groupId} onChange={(groupId) => {
        const group = groups.find((item) => String(item.id) === groupId)
        setForm({ ...form, groupId, amount: group?.monthlyAmount || form.amount, paidAmount: group?.monthlyAmount || form.paidAmount })
      }} options={groups.map((group) => [group.id, group.name])} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Month" value={form.month} onChange={(month) => setForm({ ...form, month })} />
        <NumberField label="Year" value={form.year} onChange={(year) => setForm({ ...form, year })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Amount" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
        <NumberField label="Paid Amount" value={form.paidAmount} onChange={(paidAmount) => setForm({ ...form, paidAmount })} />
      </div>
      <SelectField label="Payment Mode" value={form.paymentMode} onChange={(paymentMode) => setForm({ ...form, paymentMode })} options={[['cash', 'Cash'], ['gpay', 'GPay'], ['phonepe', 'PhonePe'], ['bank_transfer', 'Bank Transfer']]} />
      <TextField label="Receipt Number" value={form.receiptNo} onChange={(receiptNo) => setForm({ ...form, receiptNo })} />
      <TextField label="Remarks" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} required={false} />
      <button className="btn-primary"><FiCheckCircle /> Save Payment</button>
    </form>
  )
}

function AuctionsPage() {
  const { data: auctions, loading, reload } = useResource<Auction[]>('/auctions')
  const { data: groups } = useResource<ChitGroup[]>('/groups')
  const { data: members } = useResource<{ items: Member[] }>('/members?limit=100')
  return (
    <Page title="Auction Module">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card title="Monthly Auction Entry">
          <AuctionForm groups={groups || []} members={members?.items || []} onSaved={reload} />
        </Card>
        <Card title="Auction History">
          <DataTable rows={auctions || []} loading={loading} columns={[
            ['group.name', 'Group'],
            ['winnerName', 'Winner'],
            ['winningAmount', 'Prize'],
            ['discount', 'Bid Discount'],
            ['auctionDate', 'Date']
          ]} />
        </Card>
      </div>
    </Page>
  )
}

function AuctionForm({ groups, members, onSaved }: { groups: ChitGroup[]; members: Member[]; onSaved: () => void }) {
  const [form, setForm] = useState({ groupId: '', winnerMemberId: '', winnerName: '', auctionDate: today(), bidAmount: 0, prizeAmount: 0, notes: '' })
  async function submit(event: FormEvent) {
    event.preventDefault()
    const winner = members.find((member) => String(member.id) === form.winnerMemberId)
    await postData('/auctions', { ...form, winnerName: winner?.name || form.winnerName, winningAmount: form.prizeAmount })
    toast.success('Auction saved')
    onSaved()
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <SelectField label="Group" value={form.groupId} onChange={(groupId) => setForm({ ...form, groupId })} options={groups.map((group) => [group.id, group.name])} />
      <SelectField label="Winner" value={form.winnerMemberId} onChange={(winnerMemberId) => setForm({ ...form, winnerMemberId })} options={members.map((member) => [member.id, member.name])} />
      <Field label="Auction Date"><input className="input" type="date" value={form.auctionDate} onChange={(event) => setForm({ ...form, auctionDate: event.target.value })} /></Field>
      <NumberField label="Bid Amount" value={form.bidAmount} onChange={(bidAmount) => setForm({ ...form, bidAmount })} />
      <NumberField label="Prize Amount" value={form.prizeAmount} onChange={(prizeAmount) => setForm({ ...form, prizeAmount })} />
      <TextField label="Remarks" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} required={false} />
      <button className="btn-primary">Save Auction</button>
    </form>
  )
}

function LedgerPage() {
  const { data, loading, reload } = useResource<LedgerEntry[]>('/ledger')
  return (
    <Page title="Ledger">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card title="Credit / Debit Entry"><LedgerForm onSaved={reload} /></Card>
        <Card title="Daily Ledger and Running Balance">
          <DataTable rows={data || []} loading={loading} columns={[
            ['type', 'Type'],
            ['title', 'Title'],
            ['amount', 'Amount'],
            ['entryDate', 'Date'],
            ['runningBalance', 'Balance']
          ]} render={(row, key) => key === 'type' ? <Badge label={(row as LedgerEntry).type} /> : formatCell(readPath(row, key))} />
        </Card>
      </div>
    </Page>
  )
}

function LedgerForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ type: 'CREDIT', title: '', amount: 0, entryDate: today(), notes: '' })
  async function submit(event: FormEvent) {
    event.preventDefault()
    await postData('/ledger', form)
    toast.success('Ledger entry saved')
    setForm({ ...form, title: '', amount: 0, notes: '' })
    onSaved()
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <SelectField label="Entry Type" value={form.type} onChange={(type) => setForm({ ...form, type })} options={[['CREDIT', 'Credit'], ['DEBIT', 'Debit']]} />
      <TextField label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} />
      <NumberField label="Amount" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
      <Field label="Entry Date"><input className="input" type="date" value={form.entryDate} onChange={(event) => setForm({ ...form, entryDate: event.target.value })} /></Field>
      <TextField label="Description" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} required={false} />
      <button className="btn-primary">Post Entry</button>
    </form>
  )
}

function ExpensesPage() {
  const { data, loading, reload } = useResource<Expense[]>('/expenses')
  const monthly = useMemo(() => (data || []).reduce((sum, item) => sum + Number(item.amount), 0), [data])
  return (
    <Page title="Expense Management" action={<Badge label={`Monthly ${money(monthly)}`} />}>
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card title="Add Expense"><ExpenseForm onSaved={reload} /></Card>
        <Card title="Expense History">
          <DataTable rows={data || []} loading={loading} columns={[
            ['title', 'Title'],
            ['category', 'Category'],
            ['amount', 'Amount'],
            ['paymentMode', 'Mode'],
            ['expenseDate', 'Date']
          ]} />
        </Card>
      </div>
    </Page>
  )
}

function ExpenseForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', category: 'Office', amount: 0, expenseDate: today(), paymentMode: 'cash', notes: '' })
  async function submit(event: FormEvent) {
    event.preventDefault()
    await postData('/expenses', form)
    toast.success('Expense saved')
    setForm({ ...form, title: '', amount: 0, notes: '' })
    onSaved()
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <TextField label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} />
      <SelectField label="Category" value={form.category} onChange={(category) => setForm({ ...form, category })} options={[['Office', 'Office'], ['Staff', 'Staff'], ['Travel', 'Travel'], ['Bank', 'Bank'], ['Maintenance', 'Maintenance']]} />
      <NumberField label="Amount" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
      <Field label="Expense Date"><input className="input" type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} /></Field>
      <SelectField label="Payment Mode" value={form.paymentMode} onChange={(paymentMode) => setForm({ ...form, paymentMode })} options={[['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank']]} />
      <TextField label="Remarks" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} required={false} />
      <button className="btn-primary">Save Expense</button>
    </form>
  )
}

function ReportsPage() {
  const { data, loading } = useResource<ReportData>('/reports')
  const rows = data?.recentCollections || []

  function exportExcel() {
    const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      member: row.member?.name,
      group: row.group?.name,
      amount: row.amount,
      paid: row.paidAmount,
      status: row.status
    })))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Collections')
    XLSX.writeFile(workbook, 'annapurna-collection-report.xlsx')
  }

  function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Annapurna Layout Monthly Report', 14, 18)
    doc.setFontSize(10)
    doc.text(`Collections: ${money(data?.summary.totalCollected)} | Pending: ${money(data?.summary.pendingAmount)} | Expenses: ${money(data?.summary.totalExpenses)}`, 14, 28)
    rows.forEach((row, index) => {
      doc.text(`${index + 1}. ${row.member?.name || '-'} / ${row.group?.name || '-'} / ${money(row.paidAmount)} / ${row.status}`, 14, 42 + index * 8)
    })
    doc.save('annapurna-monthly-report.pdf')
  }

  return (
    <Page title="Reports" action={<div className="flex gap-2"><button className="btn-secondary" onClick={exportPdf}><FiDownload /> PDF</button><button className="btn-secondary" onClick={exportExcel}><FiDownload /> Excel</button></div>}>
      <div className="grid gap-4 md:grid-cols-4">
        <Card><Metric label="Monthly Report" value={money(data?.summary.totalCollected)} /></Card>
        <Card><Metric label="Pending Dues" value={money(data?.summary.pendingAmount)} /></Card>
        <Card><Metric label="Auction Report" value={money(data?.summary.totalAuctionValue)} /></Card>
        <Card><Metric label="Expense Report" value={money(data?.summary.totalExpenses)} /></Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Collection Report"><MonthlyChart data={data?.monthlyCollections || []} /></Card>
        <Card title="Expense Categories"><ExpenseBars data={data?.expenseByCategory || []} /></Card>
      </div>
      <div className="mt-6">
        <Card title="Recent Collection Report">
          <DataTable rows={rows} loading={loading} columns={[
            ['member.name', 'Member'],
            ['group.name', 'Group'],
            ['amount', 'Amount'],
            ['paidAmount', 'Paid'],
            ['status', 'Status']
          ]} />
        </Card>
      </div>
    </Page>
  )
}

function NotificationsPage() {
  const { data, reload } = useResource<NotificationItem[]>('/notifications')
  const { data: members } = useResource<{ items: Member[] }>('/members?limit=100')
  const [memberId, setMemberId] = useState('')

  async function sendReminder() {
    const member = members?.items.find((item) => String(item.id) === memberId)
    await postData('/notifications/payment-reminder', {
      sentTo: member?.phone || member?.name || 'member',
      message: `${member?.name || 'Member'}, your Annapurna chit fund payment is pending.`
    })
    toast.success('Payment reminder queued')
    reload()
  }

  return (
    <Page title="Notifications" action={<button className="btn-primary" onClick={sendReminder} disabled={!memberId}><FiSend /> Send Reminder</button>}>
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card title="Payment Reminder">
          <SelectField label="Member" value={memberId} onChange={setMemberId} options={(members?.items || []).map((member) => [member.id, `${member.name} - ${member.phone}`])} />
        </Card>
        <Card title="Notification History">
          <DataTable rows={data || []} columns={[
            ['title', 'Title'],
            ['message', 'Message'],
            ['sentTo', 'Sent To'],
            ['status', 'Status'],
            ['createdAt', 'Date']
          ]} render={(row, key) => key === 'status' ? <Badge label={(row as NotificationItem).status} /> : formatCell(readPath(row, key))} />
        </Card>
      </div>
    </Page>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { token, dispatch } = useAuth()

  useEffect(() => {
    const handleUnauthorized = () => {
      dispatch(logout())
    }

    window.addEventListener('annapurna:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('annapurna:unauthorized', handleUnauthorized)
  }, [dispatch])

  return token ? children : <Navigate to="/login" replace />
}

function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      setData(await getData<T>(url))
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        toast.error(apiError(error))
      }
      setData(null)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    reload()
  }, [url])
  return { data, loading, reload }
}

function Page({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Annapurna Layout finance administration</p>
        </div>
        {action && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-slate-800/90 dark:bg-slate-900/80 sm:p-5">
      {title && <h3 className="mb-4 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>}
      {children}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

function TextField({ label, value, onChange, required = true }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <Field label={label}>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </Field>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input className="input" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} required />
    </Field>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: (string | number)[][] }) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Select {label}</option>
        {options.map(([optionValue, optionLabel]) => <option key={String(optionValue)} value={optionValue}>{optionLabel}</option>)}
      </select>
    </Field>
  )
}

function DataTable<T extends object>({ rows, columns, loading, render }: {
  rows: T[]
  columns: [string, string][]
  loading?: boolean
  render?: (row: T, key: string) => ReactNode
}) {
  return (
    <div className="-mx-4 table-scroll sm:mx-0">
      <table className="w-full min-w-[720px] text-left text-sm sm:min-w-full">
        <thead>
          <tr className="border-b border-sky-100 bg-sky-50/60 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            {columns.map(([key, label]) => <th key={key} className="whitespace-nowrap px-4 py-3 font-semibold first:sm:rounded-l-lg last:sm:rounded-r-lg">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String((row as { id?: number }).id || index)} className="border-b border-slate-100 transition hover:bg-sky-50/50 dark:border-slate-800 dark:hover:bg-slate-800/40">
              {columns.map(([key]) => <td key={key} className="px-4 py-3 align-middle text-slate-700 dark:text-slate-200">{render ? render(row, key) : formatCell(readPath(row, key))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <Empty text="Loading records..." />}
      {!loading && !rows.length && <Empty text="No records found." />}
    </div>
  )
}

function RowActions({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2">
      <IconButton label="View" onClick={onView}><FiEye /></IconButton>
      <IconButton label="Edit" onClick={onEdit}><FiEdit2 /></IconButton>
      <IconButton label="Delete" onClick={onDelete}><FiTrash2 /></IconButton>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button title={label} aria-label={label} onClick={onClick} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-white/80 text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">{children}</button>
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block w-full sm:w-80">
      <FiSearch className="absolute left-3 top-3 text-slate-400" />
      <input className="input pl-9" aria-label="Search records" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (page: number) => void }) {
  const pages = Math.max(Math.ceil(total / limit), 1)
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-slate-500">Page {page} of {pages}</span>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  )
}

function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/80 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <IconButton label="Close" onClick={onClose}><FiX /></IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

function DetailList({ rows }: { rows: [string, ReactNode][] }) {
  return <div className="grid gap-3">{rows.map(([label, value]) => <div key={label} className="grid gap-1 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 sm:grid-cols-[160px_1fr]"><span className="font-semibold text-slate-500">{label}</span><span>{value}</span></div>)}</div>
}

function Avatar({ member }: { member: Member }) {
  return member.photo ? <img src={member.photo} alt={member.name} className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700">{member.name.slice(0, 1).toUpperCase()}</div>
}

function Badge({ label }: { label: string }) {
  const color = label === 'PAID' || label === 'ACTIVE' || label === 'CREDIT'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
    : label === 'PENDING' || label === 'PARTIAL'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{label}</span>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>
}

function Empty({ text }: { text: string }) {
  return <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{text}</p>
}

function MonthlyChart({ data }: { data: { month: number; paid: number; due: number }[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => money(Number(value))} />
          <Legend />
          <Bar dataKey="paid" fill="#0f8fd2" radius={[6, 6, 0, 0]} />
          <Bar dataKey="due" fill="#94a3b8" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AuctionTrend({ data }: { data: { month: string; bidAmount: number; prizeAmount: number }[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => money(Number(value))} />
          <Legend />
          <Line type="monotone" dataKey="bidAmount" stroke="#0f8fd2" strokeWidth={3} />
          <Line type="monotone" dataKey="prizeAmount" stroke="#f59e0b" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={110} label>
            {data.map((item, index) => <Cell key={item.name} fill={pieColors[index % pieColors.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function ExpenseBars({ data }: { data: { category: string; amount: number }[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip formatter={(value) => money(Number(value))} />
          <Bar dataKey="amount" fill="#0f8fd2" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function readPath(row: object, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object') return (value as Record<string, unknown>)[key]
    return undefined
  }, row)
}

function formatCell(value: unknown) {
  if (typeof value === 'number') return value > 999 ? money(value) : value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return new Date(value).toLocaleDateString('en-IN')
  return String(value ?? '-')
}

function apiError(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    return response?.data?.message || 'Request failed'
  }
  return 'Request failed'
}

function isUnauthorizedError(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response
    return response?.status === 401
  }
  return false
}

export default App
