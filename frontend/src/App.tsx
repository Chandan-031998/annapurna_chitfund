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
  FiMessageCircle,
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
  chitGroupIds?: number[]
  chits?: Pick<ChitGroup, 'id' | 'name' | 'monthlyAmount' | 'status'>[]
  chitsJoined?: string
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
  paymentDate?: string
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

interface MemberDashboardData {
  member: Member
  summary: {
    chits: number
    paidAmount: number
    duesAmount: number
    receipts?: number
    nextPaymentDate?: string | null
    auctionStatus?: string
  }
  chits: MemberPortalChit[]
  recentPayments: Collection[]
  dues: Collection[]
  receipts?: Collection[]
  auctionStatus?: MemberAuctionStatus[]
}

interface MemberPortalChit {
  id: number
  name: string
  monthlyAmount: number
  joinDate?: string
  status: Status
}

interface MemberAuctionStatus {
  id: number
  auctionMonth?: string
  auctionDate?: string
  bidAmount: number
  prizeAmount: number
  notes?: string
  group?: Pick<ChitGroup, 'id' | 'name'>
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
    monthlyCollected?: number
  }
  monthlyCollections: { month: number; paid: number; due: number }[]
  auctionTrends: { month: string; bidAmount: number; prizeAmount: number }[]
  paymentStatus: { name: string; value: number }[]
  expenseByCategory: { category: string; amount: number }[]
  pendingPayments: Collection[]
  recentCollections: Collection[]
  dueTracking?: {
    records: Collection[]
    monthWise: { name: string; amount: number; count: number }[]
    memberWise: { name: string; amount: number; count: number }[]
    chitWise: { name: string; amount: number; count: number }[]
  }
  upcomingAuction?: {
    id: number
    groupName?: string
    auctionDate?: string
    auctionMonth?: string
    bidAmount: number
    prizeAmount: number
  } | null
  recentActivity?: { id: number; action: string; description?: string; role?: string; createdAt: string }[]
}

interface NavItem {
  to: string
  label: string
  icon: IconType
}

const adminNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: FiHome },
  { to: '/members', label: 'Members', icon: FiUsers },
  { to: '/chit-groups', label: 'Chit Groups', icon: FiActivity },
  { to: '/collections', label: 'Collections', icon: FiCreditCard },
  { to: '/auctions', label: 'Auctions', icon: FiTrendingUp },
  { to: '/ledger', label: 'Ledger', icon: FiBookOpen },
  { to: '/expenses', label: 'Expenses', icon: FiDollarSign },
  { to: '/reports', label: 'Reports', icon: FiBarChart2 },
  { to: '/notifications', label: 'Notifications', icon: FiSend }
]

const memberNavItems: NavItem[] = [
  { to: '/member/dashboard', label: 'My Dashboard', icon: FiHome },
  { to: '/member/chits', label: 'My Chits', icon: FiActivity },
  { to: '/member/payments', label: 'My Payments', icon: FiCreditCard },
  { to: '/member/dues', label: 'My Dues', icon: FiDollarSign },
  { to: '/member/auction-status', label: 'My Auction Status', icon: FiTrendingUp },
  { to: '/member/receipts', label: 'My Receipts', icon: FiBookOpen },
  { to: '/notifications', label: 'Notifications', icon: FiSend },
  { to: '/member/profile', label: 'Profile', icon: FiUsers }
]

const pieColors = ['#0f8fd2', '#f59e0b', '#64748b', '#ef4444']
const money = (value: number | string | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const formatChitName = (group: Pick<ChitGroup, 'name' | 'monthlyAmount'>) => `${group.name} ${money(group.monthlyAmount)}`
const formatDate = (value?: string | Date | null) => value ? new Date(value).toLocaleDateString('en-IN') : '-'
const today = () => new Date().toISOString().slice(0, 10)
const monthNow = () => new Date().getMonth() + 1
const monthLabel = (month: number, year?: number) => `${new Date(2026, Math.max(month - 1, 0), 1).toLocaleString('en-IN', { month: 'long' })}${year ? ` ${year}` : ''}`

function receiptPdf(collection: Collection) {
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('Annapurna Layout Chit Fund', 14, 18)
  doc.setFontSize(13)
  doc.text('Payment Receipt', 14, 28)
  doc.setFontSize(10)
  const rows = [
    ['Receipt number', collection.receiptNo || '-'],
    ['Member name', collection.member?.name || '-'],
    ['Chit group', collection.group?.name || '-'],
    ['Paid amount', money(collection.paidAmount)],
    ['Payment mode', collection.paymentMode || '-'],
    ['Payment date', formatDate(collection.paymentDate)],
    ['Status', collection.status]
  ]
  rows.forEach(([label, value], index) => doc.text(`${label}: ${value}`, 14, 44 + index * 9))
  doc.line(135, 118, 190, 118)
  doc.text('Admin signature', 148, 126)
  doc.save(`${collection.receiptNo || `receipt-${collection.id}`}.pdf`)
}

function whatsappDueUrl(collection: Collection) {
  const phone = String(collection.member?.phone || '').replace(/\D/g, '')
  const amount = money(collection.amount - collection.paidAmount)
  const message = `Dear ${collection.member?.name || 'Member'}, your chit payment of ${amount} for ${monthLabel(collection.month, collection.year)} is pending. Please pay soon.`
  return `https://wa.me/${phone ? `91${phone.slice(-10)}` : ''}?text=${encodeURIComponent(message)}`
}

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
        const response = await dispatch(loginUser({ email: values.email, password: values.password })).unwrap()
        toast.success('Login successful')
        navigate(response.user.role === 'ADMIN' ? '/dashboard' : '/member/dashboard')
      } else {
        const response = await dispatch(registerUser({
          name: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password,
          role: (values.role || 'MEMBER') as Role
        })).unwrap()
        toast.success('Account created')
        navigate(response.user.role === 'ADMIN' ? '/dashboard' : '/member/dashboard')
      }
    } catch (error) {
      toast.error(mode === 'login' ? 'Authentication failed' : apiError(error))
    }
  })

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-sky-50 via-white to-amber-50 text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <section>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/70 px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm">
            <FiShield /> Secure finance operations
          </div>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight text-slate-950 sm:text-5xl">Annapurna Layout Chit Fund Management System</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">A production workspace for members, chit groups, collections, auctions, ledger, expenses, reminders and analytics.</p>
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
  const visibleNav = user?.role === 'ADMIN' ? adminNavItems : memberNavItems

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
        <main className="min-w-0 lg:pl-72">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b border-white/70 bg-white/95 px-3 py-3 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/95 sm:gap-3 sm:px-6">
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
          <div className="mx-auto w-full max-w-[1600px] p-3 sm:p-6">
            <Routes>
              <Route path="/" element={<Navigate to={user?.role === 'ADMIN' ? '/dashboard' : '/member/dashboard'} replace />} />
              <Route path="/dashboard" element={<RoleRoute role="ADMIN"><Dashboard /></RoleRoute>} />
              <Route path="/members" element={<RoleRoute role="ADMIN"><MembersPage /></RoleRoute>} />
              <Route path="/groups" element={<Navigate to="/chit-groups" replace />} />
              <Route path="/chit-groups" element={<RoleRoute role="ADMIN"><GroupsPage /></RoleRoute>} />
              <Route path="/collections" element={<RoleRoute role="ADMIN"><CollectionsPage /></RoleRoute>} />
              <Route path="/auctions" element={<RoleRoute role="ADMIN"><AuctionsPage /></RoleRoute>} />
              <Route path="/ledger" element={<RoleRoute role="ADMIN"><LedgerPage /></RoleRoute>} />
              <Route path="/expenses" element={<RoleRoute role="ADMIN"><ExpensesPage /></RoleRoute>} />
              <Route path="/reports" element={<RoleRoute role="ADMIN"><ReportsPage /></RoleRoute>} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/member/dashboard" element={<RoleRoute role="MEMBER"><MemberDashboardPage /></RoleRoute>} />
              <Route path="/member/chits" element={<RoleRoute role="MEMBER"><MemberChitsPage /></RoleRoute>} />
              <Route path="/member/payments" element={<RoleRoute role="MEMBER"><MemberPaymentsPage /></RoleRoute>} />
              <Route path="/member/dues" element={<RoleRoute role="MEMBER"><MemberDuesPage /></RoleRoute>} />
              <Route path="/member/auction-status" element={<RoleRoute role="MEMBER"><MemberAuctionStatusPage /></RoleRoute>} />
              <Route path="/member/receipts" element={<RoleRoute role="MEMBER"><MemberReceiptsPage /></RoleRoute>} />
              <Route path="/member/profile" element={<RoleRoute role="MEMBER"><MemberProfilePage /></RoleRoute>} />
              <Route path="*" element={<Navigate to={user?.role === 'ADMIN' ? '/dashboard' : '/member/dashboard'} replace />} />
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
    { label: 'Monthly Collections', value: money(summary?.monthlyCollected ?? summary?.totalCollected), icon: FiCreditCard },
    { label: 'Pending Dues', value: money(summary?.pendingAmount), icon: FiBarChart2 },
    { label: 'Total Expenses', value: money(summary?.totalExpenses), icon: FiDollarSign },
    { label: 'Profit / Loss', value: money(summary?.profit), icon: FiTrendingUp }
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
        <Card title="Recent Payments">
          <DataTable rows={data?.recentCollections || []} columns={[
            ['member.name', 'Member'],
            ['group.name', 'Group'],
            ['paidAmount', 'Paid'],
            ['status', 'Status']
          ]} loading={loading} />
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Upcoming Auction">
          {data?.upcomingAuction ? (
            <DetailList rows={[
              ['Group', data.upcomingAuction.groupName || '-'],
              ['Auction Date', formatDate(data.upcomingAuction.auctionDate)],
              ['Bid Amount', money(data.upcomingAuction.bidAmount)],
              ['Prize Amount', money(data.upcomingAuction.prizeAmount)]
            ]} />
          ) : <Empty text="No upcoming auction scheduled." />}
        </Card>
        <Card title="Recent Activity">
          <DataTable rows={data?.recentActivity || []} columns={[
            ['action', 'Action'],
            ['description', 'Details'],
            ['role', 'Role'],
            ['createdAt', 'Date']
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
  const { data: groups } = useResource<ChitGroup[]>('/groups')
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
          <MemberForm value={editing} groups={groups || []} onSaved={() => { setEditing(null); reload() }} />
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
            ['chitsJoined', 'Chits Joined'],
            ['status', 'Status'],
            ['actions', 'Actions']
          ]} render={(row, key) => {
            const member = row as Member
            if (key === 'photo') return <Avatar member={member} />
            if (key === 'chitsJoined') return member.chits?.length ? member.chits.map(formatChitName).join(', ') : '-'
            if (key === 'status') return (
              <div className="grid gap-1">
                <Badge label={member.status} />
                <span className="text-xs text-slate-500">Joined {formatDate(member.joinedAt)}</span>
              </div>
            )
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
          ['Chits Joined', viewing.chits?.length ? viewing.chits.map(formatChitName).join(', ') : '-'],
          ['Joining Date', formatDate(viewing.joinedAt)],
          ['Status', viewing.status]
        ]} />}
      </Modal>
    </Page>
  )
}

function MemberForm({ value, groups, onSaved }: { value: Member | null; groups: ChitGroup[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    memberCode: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    aadhaarNumber: '',
    photo: '',
    status: 'ACTIVE',
    chitGroupIds: [] as number[]
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
      status: value?.status || 'ACTIVE',
      chitGroupIds: value?.chitGroupIds || value?.chits?.map((chit) => chit.id) || (value?.groupId ? [value.groupId] : [])
    })
  }, [value])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, chit_group_ids: form.chitGroupIds }
      if (value) await api.put(`/members/${value.id}`, payload)
      else await postData('/members', payload)
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
      <Field label="Select Chit Groups">
        <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
          {groups.map((group) => {
            const checked = form.chitGroupIds.includes(group.id)
            return (
              <label key={group.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-sky-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600"
                  checked={checked}
                  onChange={(event) => {
                    const chitGroupIds = event.target.checked
                      ? [...form.chitGroupIds, group.id]
                      : form.chitGroupIds.filter((id) => id !== group.id)
                    setForm({ ...form, chitGroupIds })
                  }}
                />
                <span>{formatChitName(group)}</span>
              </label>
            )
          })}
          {!groups.length && <p className="p-3 text-sm text-slate-500">No chit groups available.</p>}
        </div>
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
  const [editing, setEditing] = useState<Collection | null>(null)

  async function remove(collection: Collection) {
    if (!confirm(`Delete collection for ${collection.member?.name || 'member'}?`)) return
    await api.delete(`/collections/${collection.id}`)
    toast.success('Collection deleted')
    if (editing?.id === collection.id) setEditing(null)
    reload()
  }

  return (
    <Page title="Collection Module">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card title={editing ? 'Edit Payment Entry' : 'Monthly Payment Entry'}>
          <CollectionForm value={editing} members={members?.items || []} groups={groups || []} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
        </Card>
        <div className="grid gap-6">
          <Card title="Pending Dues">
            <DataTable rows={(collections || []).filter((item) => item.status !== 'PAID')} columns={[
              ['member.name', 'Member'],
              ['group.name', 'Group'],
              ['amount', 'Due'],
              ['status', 'Status'],
              ['actions', 'Actions']
            ]} render={(row, key) => {
              const collection = row as Collection
              if (key === 'status') return <Badge label={collection.status} />
              if (key === 'actions') return <DueActions collection={collection} />
              return formatCell(readPath(row, key))
            }} />
          </Card>
          <Card title="Collection History">
            <DataTable rows={collections || []} loading={loading} columns={[
              ['receiptNo', 'Receipt'],
              ['paymentDate', 'Collected Date'],
              ['member.name', 'Member'],
              ['group.name', 'Group'],
              ['paidAmount', 'Paid'],
              ['paymentMode', 'Mode'],
              ['status', 'Status'],
              ['actions', 'Actions']
            ]} render={(row, key) => {
              const collection = row as Collection
              if (key === 'status') return <Badge label={collection.status} />
              if (key === 'paymentDate') return formatDate(collection.paymentDate)
              if (key === 'actions') return <CollectionActions collection={collection} onEdit={() => setEditing(collection)} onDelete={() => remove(collection)} />
              return formatCell(readPath(row, key))
            }} />
          </Card>
        </div>
      </div>
    </Page>
  )
}

function CollectionForm({ value, members, groups, onCancel, onSaved }: { value: Collection | null; members: Member[]; groups: ChitGroup[]; onCancel: () => void; onSaved: () => void }) {
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

  useEffect(() => {
    setForm({
      memberId: value?.member?.id ? String(value.member.id) : '',
      groupId: value?.group?.id ? String(value.group.id) : '',
      month: value?.month || monthNow(),
      year: value?.year || new Date().getFullYear(),
      amount: value?.amount || 5000,
      paidAmount: value?.paidAmount || value?.amount || 5000,
      paymentMode: value?.paymentMode || 'cash',
      receiptNo: value?.receiptNo || `RCPT-${Date.now().toString().slice(-6)}`,
      notes: value?.notes || ''
    })
  }, [value])

  const selectedMember = members.find((member) => String(member.id) === form.memberId)
  const availableGroups = selectedMember?.chits?.length
    ? groups.filter((group) => selectedMember.chits?.some((chit) => chit.id === group.id))
    : groups

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (value) {
      await api.put(`/collections/${value.id}`, form)
      toast.success('Collection updated')
    } else {
      await postData('/collections', form)
      toast.success(`Receipt ${form.receiptNo} recorded`)
      setForm({ ...form, receiptNo: `RCPT-${Date.now().toString().slice(-6)}`, paidAmount: form.amount })
    }
    onSaved()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <SelectField label="Member" value={form.memberId} onChange={(memberId) => {
        const member = members.find((item) => String(item.id) === memberId)
        const memberGroups = member?.chits?.length ? groups.filter((group) => member.chits?.some((chit) => chit.id === group.id)) : groups
        const keepGroup = memberGroups.some((group) => String(group.id) === form.groupId)
        setForm({ ...form, memberId, groupId: keepGroup ? form.groupId : '', amount: keepGroup ? form.amount : 0, paidAmount: keepGroup ? form.paidAmount : 0 })
      }} options={members.map((member) => [member.id, member.name])} />
      <SelectField label="Group" value={form.groupId} onChange={(groupId) => {
        const group = availableGroups.find((item) => String(item.id) === groupId)
        setForm({ ...form, groupId, amount: group?.monthlyAmount || form.amount, paidAmount: group?.monthlyAmount || form.paidAmount })
      }} options={availableGroups.map((group) => [group.id, group.name])} />
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
      <div className="grid gap-2 sm:grid-cols-2">
        {value && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
        <button className="btn-primary"><FiCheckCircle /> {value ? 'Update Payment' : 'Save Payment'}</button>
      </div>
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

  async function logExport(reportType: string, format: 'pdf' | 'excel') {
    try {
      await api.post('/reports/export-log', { reportType, format })
    } catch {
      toast.error('Report downloaded, but export activity was not logged')
    }
  }

  async function exportExcel() {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.map((row) => ({
      member: row.member?.name,
      group: row.group?.name,
      amount: row.amount,
      paid: row.paidAmount,
      status: row.status,
      date: formatDate(row.paymentDate)
    }))), 'Collection')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((data?.dueTracking?.records || []).map((row) => ({
      member: row.member?.name,
      group: row.group?.name,
      month: monthLabel(row.month, row.year),
      due: row.amount - row.paidAmount,
      status: row.status
    }))), 'Dues')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data?.expenseByCategory || []), 'Expenses')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data?.auctionTrends || []), 'Auctions')
    XLSX.writeFile(workbook, 'annapurna-reports.xlsx')
    await logExport('All reports', 'excel')
  }

  async function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Annapurna Layout Chit Fund Report', 14, 18)
    doc.setFontSize(10)
    doc.text(`Collections: ${money(data?.summary.totalCollected)} | Dues: ${money(data?.summary.pendingAmount)} | Expenses: ${money(data?.summary.totalExpenses)} | Profit/Loss: ${money(data?.summary.profit)}`, 14, 28)
    doc.text('Collection Report', 14, 40)
    rows.forEach((row, index) => {
      doc.text(`${index + 1}. ${row.member?.name || '-'} / ${row.group?.name || '-'} / ${money(row.paidAmount)} / ${row.status}`, 14, 50 + index * 8)
    })
    const dueStart = 58 + rows.length * 8
    doc.text('Due Report', 14, dueStart)
    ;(data?.dueTracking?.records || []).slice(0, 12).forEach((row, index) => {
      doc.text(`${index + 1}. ${row.member?.name || '-'} / ${row.group?.name || '-'} / ${money(row.amount - row.paidAmount)} / ${monthLabel(row.month, row.year)}`, 14, dueStart + 10 + index * 8)
    })
    doc.save('annapurna-reports.pdf')
    await logExport('All reports', 'pdf')
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
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Month-wise Pending Dues">
          <DataTable rows={data?.dueTracking?.monthWise || []} loading={loading} columns={[
            ['name', 'Month'],
            ['amount', 'Pending'],
            ['count', 'Records']
          ]} />
        </Card>
        <Card title="Member-wise Pending Dues">
          <DataTable rows={data?.dueTracking?.memberWise || []} loading={loading} columns={[
            ['name', 'Member'],
            ['amount', 'Pending'],
            ['count', 'Records']
          ]} />
        </Card>
        <Card title="Chit-wise Pending Dues">
          <DataTable rows={data?.dueTracking?.chitWise || []} loading={loading} columns={[
            ['name', 'Chit'],
            ['amount', 'Pending'],
            ['count', 'Records']
          ]} />
        </Card>
      </div>
    </Page>
  )
}

function MemberDashboardPage() {
  const { data, loading } = useResource<MemberDashboardData>('/member/dashboard')
  return (
    <Page title="My Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card><Metric label="My Active Chits" value={String(data?.summary.chits || 0)} /></Card>
        <Card><Metric label="My Paid Amount" value={money(data?.summary.paidAmount)} /></Card>
        <Card><Metric label="My Pending Dues" value={money(data?.summary.duesAmount)} /></Card>
        <Card><Metric label="My Next Payment Date" value={formatDate(data?.summary.nextPaymentDate)} /></Card>
        <Card><Metric label="My Auction Status" value={data?.summary.auctionStatus || 'No active auction'} /></Card>
        <Card><Metric label="My Receipts" value={String(data?.summary.receipts || 0)} /></Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="My Chits">
          <DataTable rows={data?.chits || []} loading={loading} columns={[
            ['name', 'Chit Group'],
            ['monthlyAmount', 'Monthly Amount'],
            ['joinDate', 'Join Date'],
            ['status', 'Status']
          ]} render={(row, key) => key === 'status' ? <Badge label={(row as { status: Status }).status} /> : key === 'joinDate' ? formatDate((row as { joinDate?: string }).joinDate) : formatCell(readPath(row, key))} />
        </Card>
        <Card title="Recent Payments">
          <DataTable rows={data?.recentPayments || []} loading={loading} columns={[
            ['paymentDate', 'Date'],
            ['group.name', 'Group'],
            ['paidAmount', 'Paid'],
            ['status', 'Status']
          ]} render={(row, key) => key === 'status' ? <Badge label={(row as Collection).status} /> : key === 'paymentDate' ? formatDate((row as Collection).paymentDate) : formatCell(readPath(row, key))} />
        </Card>
      </div>
    </Page>
  )
}

function MemberChitsPage() {
  const { data, loading } = useResource<MemberPortalChit[]>('/member/chits')
  return (
    <Page title="My Chits">
      <Card>
        <DataTable rows={data || []} loading={loading} columns={[
          ['name', 'Chit Group'],
          ['monthlyAmount', 'Monthly Amount'],
          ['joinDate', 'Join Date'],
          ['status', 'Status']
        ]} render={(row, key) => key === 'status' ? <Badge label={(row as { status: Status }).status} /> : key === 'joinDate' ? formatDate((row as { joinDate?: string }).joinDate) : formatCell(readPath(row, key))} />
      </Card>
    </Page>
  )
}

function MemberPaymentsPage() {
  const { data, loading } = useResource<Collection[]>('/member/payments')
  return <MemberCollectionsReadOnlyPage title="My Payments" rows={data || []} loading={loading} />
}

function MemberDuesPage() {
  const { data, loading } = useResource<Collection[]>('/member/dues')
  return <MemberCollectionsReadOnlyPage title="My Dues" rows={data || []} loading={loading} />
}

function MemberReceiptsPage() {
  const { data, loading } = useResource<Collection[]>('/member/receipts')
  return <MemberCollectionsReadOnlyPage title="My Receipts" rows={data || []} loading={loading} includeReceipt />
}

function MemberCollectionsReadOnlyPage({ title, rows, loading, includeReceipt = false }: { title: string; rows: Collection[]; loading?: boolean; includeReceipt?: boolean }) {
  const columns: [string, string][] = [
    ...(includeReceipt ? [['receiptNo', 'Receipt'] as [string, string]] : []),
    ['paymentDate', 'Date'],
    ['group.name', 'Group'],
    ['amount', 'Amount'],
    ['paidAmount', 'Paid'],
    ['status', 'Status'],
    ...(includeReceipt ? [['actions', 'Actions'] as [string, string]] : [])
  ]
  return (
    <Page title={title}>
      <Card>
        <DataTable rows={rows} loading={loading} columns={columns} render={(row, key) => {
          const collection = row as Collection
          if (key === 'status') return <Badge label={collection.status} />
          if (key === 'paymentDate') return formatDate(collection.paymentDate)
          if (key === 'actions') return collection.receiptNo ? <IconButton label="Download receipt" onClick={() => receiptPdf(collection)}><FiDownload /></IconButton> : '-'
          return formatCell(readPath(row, key))
        }} />
      </Card>
    </Page>
  )
}

function MemberAuctionStatusPage() {
  const { data, loading } = useResource<MemberAuctionStatus[]>('/member/auction-status')
  return (
    <Page title="My Auction Status">
      <Card>
        <DataTable rows={data || []} loading={loading} columns={[
          ['auctionDate', 'Auction Date'],
          ['group.name', 'Group'],
          ['bidAmount', 'Bid Amount'],
          ['prizeAmount', 'Prize Amount'],
          ['notes', 'Notes']
        ]} render={(row, key) => key === 'auctionDate' ? formatDate((row as MemberAuctionStatus).auctionDate) : formatCell(readPath(row, key))} />
      </Card>
    </Page>
  )
}

function MemberProfilePage() {
  const { data, loading } = useResource<MemberDashboardData>('/member/dashboard')
  return (
    <Page title="Profile">
      <Card title="My Profile">
        {loading && <Empty text="Loading profile..." />}
        {data?.member && <DetailList rows={[
          ['Member Code', data.member.memberCode],
          ['Name', data.member.name],
          ['Phone', data.member.phone],
          ['Email', data.member.email || '-'],
          ['Address', data.member.address || '-'],
          ['Joining Date', formatDate(data.member.joinedAt)],
          ['Status', <Badge label={data.member.status} />]
        ]} />}
      </Card>
    </Page>
  )
}

function NotificationsPage() {
  const { user } = useAuth()
  const { data, reload } = useResource<NotificationItem[]>('/notifications')
  const { data: members } = useResource<{ items: Member[] }>(user?.role === 'ADMIN' ? '/members?limit=100' : '')
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
    <Page title="Notifications" action={user?.role === 'ADMIN' ? <button className="btn-primary" onClick={sendReminder} disabled={!memberId}><FiSend /> Send Reminder</button> : undefined}>
      <div className={`grid gap-6 ${user?.role === 'ADMIN' ? 'xl:grid-cols-[360px_1fr]' : ''}`}>
        {user?.role === 'ADMIN' && (
          <Card title="Payment Reminder">
            <SelectField label="Member" value={memberId} onChange={setMemberId} options={(members?.items || []).map((member) => [member.id, `${member.name} - ${member.phone}`])} />
          </Card>
        )}
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

function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={user.role === 'ADMIN' ? '/dashboard' : '/member/dashboard'} replace />
  return children
}

function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = async () => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }

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
    <section className="min-w-0">
      <div className="mb-4 flex flex-col justify-between gap-4 rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80 sm:mb-6 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-slate-950 dark:text-white sm:text-2xl">{title}</h2>
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
    <div className="min-w-0 rounded-xl border border-white/80 bg-white/90 p-4 shadow-soft backdrop-blur dark:border-slate-800/90 dark:bg-slate-900/85 sm:p-5">
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
  const renderCell = (row: T, key: string) => render ? render(row, key) : formatCell(readPath(row, key))
  const actionColumn = columns.find(([key]) => key === 'actions')
  const contentColumns = columns.filter(([key]) => key !== 'actions')

  return (
    <div className="min-w-0">
      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <div key={String((row as { id?: number }).id || index)} className="rounded-lg border border-slate-200 bg-white/80 p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="grid gap-2">
              {contentColumns.map(([key, label]) => (
                <div key={key} className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0 dark:border-slate-800">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
                  <div className="min-w-0 break-words text-slate-800 dark:text-slate-100">{renderCell(row, key)}</div>
                </div>
              ))}
            </div>
            {actionColumn && <div className="mt-3 flex justify-end">{renderCell(row, actionColumn[0])}</div>}
          </div>
        ))}
      </div>
      <div className="table-scroll hidden md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-sky-100 bg-sky-50/60 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            {columns.map(([key, label]) => <th key={key} className="whitespace-nowrap px-4 py-3 font-semibold first:sm:rounded-l-lg last:sm:rounded-r-lg">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String((row as { id?: number }).id || index)} className="border-b border-slate-100 transition hover:bg-sky-50/50 dark:border-slate-800 dark:hover:bg-slate-800/40">
              {columns.map(([key]) => <td key={key} className="px-4 py-3 align-middle text-slate-700 dark:text-slate-200">{renderCell(row, key)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
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

function EditDeleteActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2">
      <IconButton label="Edit" onClick={onEdit}><FiEdit2 /></IconButton>
      <IconButton label="Delete" onClick={onDelete}><FiTrash2 /></IconButton>
    </div>
  )
}

function DueActions({ collection }: { collection: Collection }) {
  return (
    <a title="WhatsApp reminder" aria-label="WhatsApp reminder" href={whatsappDueUrl(collection)} target="_blank" rel="noreferrer" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
      <FiMessageCircle />
    </a>
  )
}

function CollectionActions({ collection, onEdit, onDelete }: { collection: Collection; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2">
      {collection.receiptNo && <IconButton label="Download receipt" onClick={() => receiptPdf(collection)}><FiDownload /></IconButton>}
      {collection.status !== 'PAID' && <DueActions collection={collection} />}
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
