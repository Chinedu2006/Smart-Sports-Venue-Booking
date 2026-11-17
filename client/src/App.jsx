import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  Users,
  LogOut,
  UserPlus,
  Menu,
  X,
  Sun,
  Moon,
  ChevronRight,
  Info,
  Phone,
  Mail,
  Building2,
  LayoutDashboard,
  ClipboardList,
  Trophy,
  Dumbbell,
  Plus,
  Edit3,
  Eye,
  EyeOff,
  Upload,
  Lock,
  ArrowRight,
  AlertTriangle,
  History,
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const AUTH_TOKEN_KEY = 'franco_token';

const apiRequest = async (path, { body, headers: requestHeaders, ...options } = {}) => {
  const headers = new Headers(requestHeaders);
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: requestBody,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('The API returned an invalid response.');
    }
  }
  if (!response.ok) {
    const error = new Error(data?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
};

const normalizeUser = (user) => ({
  id: String(user?._id ?? user?.id ?? ''),
  name: user?.fullName ?? user?.name ?? '',
  email: user?.email ?? '',
  phone: user?.phone ?? '',
  department: user?.department ?? '',
  role: user?.role ?? 'customer',
  canManagePitches: Boolean(user?.canManagePitches),
  status: user?.accountStatus ?? user?.status ?? 'active',
  joinedAt: String(user?.createdAt ?? user?.joinedAt ?? '').slice(0, 10),
});

const getEntityId = (value) => {
  if (value && typeof value === 'object') return String(value._id ?? value.id ?? '');
  return String(value ?? '');
};

const normalizePitch = (pitch) => ({
  ...pitch,
  id: getEntityId(pitch),
  surface: pitch.surfaceType ?? pitch.surface ?? '',
  capacity: pitch.capacity ?? pitch.surfaceType ?? 'Football Pitch',
  rateLabel: pitch.pricingNote ?? pitch.rateLabel ?? '',
  image: pitch.imageUrl ?? pitch.image ?? '',
});

const normalizeFacility = (facility) => ({
  ...facility,
  id: getEntityId(facility),
  usageFee: facility.feeInfo ?? facility.usageFee ?? '',
  image: facility.imageUrl ?? facility.image ?? '',
  equipment: Array.isArray(facility.equipment) ? facility.equipment : [],
});

const normalizeBooking = (booking) => {
  const customer = booking.customerId && typeof booking.customerId === 'object'
    ? booking.customerId
    : null;
  return {
    ...booking,
    id: getEntityId(booking),
    pitchId: getEntityId(booking.pitchId),
    customerId: getEntityId(booking.customerId),
    customerName: customer?.fullName ?? booking.customerName ?? '',
    customerEmail: customer?.email ?? booking.customerEmail ?? '',
    contactPhone: booking.contactPhone ?? customer?.phone ?? '',
    date: booking.bookingDate ?? booking.date ?? '',
    startHour: Number(booking.startHour),
    endHour: Number(booking.endHour),
    createdAt: booking.createdAt
      ? new Date(booking.createdAt).toLocaleString()
      : booking.createdAt ?? '',
  };
};

const normalizeAuditLog = (log) => ({
  ...log,
  id: getEntityId(log),
  previousStatus: log.previousStatus ?? '—',
  timestamp: log.createdAt ? new Date(log.createdAt).toLocaleString() : log.timestamp ?? '',
});

// ============================================================================
// 1. APP CONSTANTS
// ============================================================================

const TODAY_STR = new Date().toISOString().split('T')[0];
const getFutureDate = (daysAhead) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

const TOMORROW_STR = getFutureDate(1);

const FACILITY_CATEGORIES = [
  { id: 'all', label: 'All Facilities' },
  { id: 'basketball', label: 'Basketball Courts' },
  { id: 'table_tennis', label: 'Table Tennis' },
  { id: 'lawn_tennis', label: 'Lawn Tennis Courts' },
  { id: 'swimming_pool', label: 'Swimming Pools' },
  { id: 'gym', label: 'Gyms' },
];

const OPERATING_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]; // 07:00 to 21:00

const formatHour = (h) => `${String(h).padStart(2, '0')}:00`;

// ============================================================================
// 2. REUSABLE UI COMPONENTS (LOGO, BADGES, MODALS, TOASTS)
// ============================================================================

const FrancoLogo = ({ size = 'md' }) => {
  const dims = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  return (
    <div className="flex items-center gap-3 select-none">
      <img
        src="/unn-logo.png"
        alt="University of Nigeria, Nsukka"
        className={`${dims} object-contain rounded-full bg-white p-0.5 shadow-sm`}
      />
      <div className="leading-tight">
        <span className="font-bold tracking-tight text-slate-900 dark:text-white text-base sm:text-lg block">
          FRANCO <span className="text-teal-700 dark:text-emerald-400">SPORTS</span>
        </span>
        <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400 block">
          University of Nigeria, Nsukka
        </span>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const normalized = (status || '').toLowerCase();
  const styles = {
    pending:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    maintenance:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    approved:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    active:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    rejected:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    suspended:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    cancelled:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    inactive:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };

  const icons = {
    pending: <Clock className="w-3.5 h-3.5" />,
    maintenance: <AlertTriangle className="w-3.5 h-3.5" />,
    approved: <CheckCircle2 className="w-3.5 h-3.5" />,
    active: <CheckCircle2 className="w-3.5 h-3.5" />,
    rejected: <XCircle className="w-3.5 h-3.5" />,
    suspended: <Ban className="w-3.5 h-3.5" />,
    cancelled: <Ban className="w-3.5 h-3.5" />,
    inactive: <Ban className="w-3.5 h-3.5" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${
        styles[normalized] || styles.inactive
      }`}
    >
      {icons[normalized]}
      {status}
    </span>
  );
};

const ImageWithFallback = ({ src, alt, className = '', fallbackLabel = 'Franco Sports' }) => {
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src || failedSrc === src) {
    return (
      <div
        className={`bg-gradient-to-br from-slate-800 via-teal-900 to-emerald-950 flex flex-col items-center justify-center text-white/80 p-4 ${className}`}
      >
        <Trophy className="w-8 h-8 mb-2 text-emerald-400 opacity-80" />
        <span className="text-xs font-medium text-center">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailedSrc(src)}
      className={`object-cover ${className}`}
    />
  );
};

const ConfirmModal = ({ isOpen, title, message, confirmLabel, confirmVariant = 'danger', onConfirm, onCancel, children }) => {
  if (!isOpen) return null;
  const btnColors =
    confirmVariant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{message}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition ${btnColors}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// Reusable Local-to-Cloudinary Image Uploader Component (Simulates Express /api/upload -> Cloudinary Pipeline)
const CloudinaryImageUploader = ({ folder = 'facilities', currentImage, currentPublicId, onUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [localFileName, setLocalFileName] = useState('');

  const processLocalFile = async (file) => {
    setUploadError('');
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file format. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB limit
    if (file.size > maxBytes) {
      setUploadError('File exceeds the 5MB maximum upload limit.');
      return;
    }

    setLocalFileName(file.name);
    setUploading(true);
    setProgress(15);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);
    try {
      setProgress(35);
      const result = await apiRequest('/api/upload', { method: 'POST', body: formData });
      setProgress(100);
      onUploaded({
        imageUrl: result.imageUrl,
        imagePublicId: result.imagePublicId,
      });
    } catch (error) {
      setUploadError(error.message || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    processLocalFile(file);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Photo Upload (Local Storage → Cloudinary CDN)
        </label>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30">
          Express Signed Proxy
        </span>
      </div>

      {currentImage && (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
          <ImageWithFallback
            src={currentImage}
            alt="Preview"
            className="w-full h-36 object-cover"
            fallbackLabel="Cloudinary Media Preview"
          />
          <div className="px-3 py-2 bg-slate-900/90 text-slate-200 text-[11px] flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[10px] text-emerald-300">
              public_id: {currentPublicId || `${folder}/sample-asset`}
            </span>
            {localFileName && (
              <span className="text-[10px] text-slate-400 shrink-0 truncate max-w-[130px]">
                {localFileName}
              </span>
            )}
          </div>
        </div>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed cursor-pointer transition text-center ${
          isDragging
            ? 'border-teal-600 bg-teal-50/70 dark:border-emerald-400 dark:bg-emerald-500/10'
            : 'border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-800/40'
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => processLocalFile(e.target.files?.[0])}
        />
        <Upload className="w-5 h-5 text-teal-700 dark:text-emerald-400 mb-1.5" />
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Choose photo from device or drag & drop here
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          JPEG, PNG, or WebP up to 5MB • Uploaded securely via Express to Cloudinary
        </span>
      </label>

      {uploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold text-teal-700 dark:text-emerald-400">
            <span>Uploading to Cloudinary...</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-teal-600 dark:bg-emerald-500 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};

// Reusable Modal for Adding or Editing Football Pitches (Accessible to Admins & Authorized Pitch Managers)
const PitchFormModal = ({ pitch, onClose, onSave }) => {
  const [formData, setFormData] = useState({ ...pitch });
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    try {
      const result = await onSave(formData);
      if (typeof result === 'string') setSaveError(result);
    } catch (error) {
      setSaveError(error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {formData.isNew ? 'Add New Football Pitch' : `Edit ${formData.name}`}
            </h3>
            <p className="text-xs text-slate-500">
              Configure pitch details, operational availability, and Cloudinary photo.
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Pitch Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g., PITCH-I"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Pitch Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Pitch I"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Operational Status *</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            >
              <option value="active">Active (Open for Online Booking)</option>
              <option value="maintenance">Maintenance (Bookings Blocked)</option>
              <option value="inactive">Inactive (Offline)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Pitch Capacity / Format *</label>
            <input
              type="text"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="e.g., 11-a-side Full Pitch"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Turf / Surface Type *</label>
            <input
              type="text"
              value={formData.surface}
              onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
              placeholder="e.g., FIFA Synthetic Turf"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Campus Location Label *</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., North Stadium Complex [Sample]"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Pricing / Usage Policy Label</label>
          <input
            type="text"
            value={formData.rateLabel}
            onChange={(e) => setFormData({ ...formData, rateLabel: e.target.value })}
            placeholder="e.g., Free for Registered Students [Sample]"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
        </div>

        <CloudinaryImageUploader
          folder="pitches"
          currentImage={formData.image}
          currentPublicId={formData.imagePublicId}
          onUploaded={({ imageUrl, imagePublicId }) =>
            setFormData({ ...formData, image: imageUrl, imagePublicId })
          }
        />

        <div>
          <label className="block text-xs font-semibold mb-1">Description *</label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe pitch lighting, surface quality, and permitted match formats..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            required
          />
        </div>

        {saveError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 text-white text-xs font-bold"
          >
            {formData.isNew ? 'Create Football Pitch' : 'Save Pitch Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// 3. MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  const [darkMode, setDarkMode] = useState(false);

  const [users, setUsers] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [availabilityBookings, setAvailabilityBookings] = useState([]);
  const [roleBookings, setRoleBookings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const bookings = useMemo(() => {
    const merged = new Map(availabilityBookings.map((booking) => [booking.id, booking]));
    roleBookings.forEach((booking) => merged.set(booking.id, booking));
    return [...merged.values()];
  }, [availabilityBookings, roleBookings]);

  const [activePage, setActivePage] = useState('home');
  const [selectedPitchIdForBooking, setSelectedPitchIdForBooking] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [inspectedPitch, setInspectedPitch] = useState(null);
  const [inspectedFacility, setInspectedFacility] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshAvailability = useCallback(async () => {
    const slots = await apiRequest('/api/bookings/availability');
    setAvailabilityBookings(slots.map(normalizeBooking));
  }, []);

  const loadPublicData = useCallback(async () => {
    const requests = [
      apiRequest('/api/pitches'),
      apiRequest('/api/facilities'),
      apiRequest('/api/bookings/availability'),
    ];
    const results = await Promise.allSettled(requests);
    const errors = [];
    if (results[0].status === 'fulfilled') {
      setPitches(results[0].value.map(normalizePitch));
    } else {
      errors.push(`Pitches: ${results[0].reason.message}`);
    }
    if (results[1].status === 'fulfilled') {
      setFacilities(results[1].value.map(normalizeFacility));
    } else {
      errors.push(`Facilities: ${results[1].reason.message}`);
    }
    if (results[2].status === 'fulfilled') {
      setAvailabilityBookings(results[2].value.map(normalizeBooking));
    } else {
      errors.push(`Booking availability: ${results[2].reason.message}`);
    }
    if (errors.length) showToast(errors.join(' '), 'error');
  }, [showToast]);

  const loadAuthenticatedData = useCallback(async (user) => {
    const jobs = [
      ['Bookings', () => apiRequest('/api/bookings')],
    ];
    if (user.role === 'admin') {
      jobs.push(
        ['Users', () => apiRequest('/api/admin/users')],
        ['Audit logs', () => apiRequest('/api/admin/audit-logs')]
      );
    }

    const results = await Promise.allSettled(jobs.map(([, request]) => request()));
    const errors = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        errors.push(`${jobs[index][0]}: ${result.reason.message}`);
      } else if (index === 0) {
        setRoleBookings(result.value.map(normalizeBooking));
      } else if (jobs[index][0] === 'Users') {
        setUsers(result.value.map(normalizeUser));
      } else if (jobs[index][0] === 'Audit logs') {
        setAuditLogs(result.value.map(normalizeAuditLog));
      }
    });
    if (errors.length) showToast(errors.join(' '), 'error');
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPublicData().catch((error) => showToast(`Could not load public data: ${error.message}`, 'error'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPublicData, showToast]);

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) return () => { active = false; };

    const restoreSession = async () => {
      try {
        const result = await apiRequest('/api/auth/me');
        if (!active) return;
        const user = normalizeUser(result.user);
        setCurrentUser(user);
        await loadAuthenticatedData(user);
      } catch (error) {
        if (!active) return;
        if (error.status === 401 || error.status === 403) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
        showToast(`Could not restore your session: ${error.message}`, 'error');
      }
    };

    restoreSession();
    return () => { active = false; };
  }, [loadAuthenticatedData, showToast]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const navigateTo = (page, pitchId = null) => {
    setMobileMenuOpen(false);
    if (pitchId) setSelectedPitchIdForBooking(pitchId);

    if (page === 'dashboard' && (!currentUser || currentUser.role !== 'customer')) {
      showToast('Please log in with a Customer account to access the Customer Dashboard.', 'error');
      setActivePage('login');
      return;
    }
    if (page === 'staff' && (!currentUser || currentUser.role !== 'staff')) {
      showToast('Restricted Area: Authorized Staff credentials required.', 'error');
      setActivePage('login');
      return;
    }
    if (page === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
      showToast('Restricted Area: Authorized Administrator credentials required.', 'error');
      setActivePage('login');
      return;
    }
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthenticate = async (mode, credentials) => {
    const result = await apiRequest(`/api/auth/${mode}`, { method: 'POST', body: credentials });
    localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    const user = normalizeUser(result.user);
    setCurrentUser(user);
    setActivePage(user.role === 'admin' ? 'admin' : user.role === 'staff' ? 'staff' : 'dashboard');
    showToast(mode === 'login' ? `Welcome back, ${user.name}!` : 'Customer account registered successfully!', 'success');
    await loadAuthenticatedData(user);
    return user;
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setCurrentUser(null);
    setUsers([]);
    setRoleBookings([]);
    setAuditLogs([]);
    setActivePage('home');
    showToast('You have been logged out.', 'info');
    refreshAvailability().catch((error) => showToast(`Could not refresh availability: ${error.message}`, 'error'));
  };

  const handleCreateBooking = async ({ pitchId, date, startHour, endHour, contactPhone, purpose }) => {
    if (!currentUser || currentUser.role !== 'customer') {
      return { ok: false, error: 'You must be logged in as a Customer to request a pitch.' };
    }

    try {
      const result = await apiRequest('/api/bookings', {
        method: 'POST',
        body: { pitchId, bookingDate: date, startHour, endHour, contactPhone, purpose },
      });
      const booking = normalizeBooking(result);
      setRoleBookings((previous) => [booking, ...previous.filter((item) => item.id !== booking.id)]);
      showToast('Booking request submitted! Status is Pending Administrator review.', 'success');
      refreshAvailability().catch((error) => showToast(`Could not refresh availability: ${error.message}`, 'error'));
      return { ok: true, booking };
    } catch (error) {
      const message = error.status === 409
        ? `Slot unavailable: ${error.message.replace(/^Slot unavailable:\s*/i, '')}`
        : error.message;
      return { ok: false, error: message };
    }
  };

  const handleCustomerCancelBooking = async (bookingId) => {
    try {
      const result = await apiRequest(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: 'PATCH' });
      const booking = normalizeBooking(result);
      setRoleBookings((previous) => previous.map((item) => item.id === booking.id ? booking : item));
      showToast(`Booking ${bookingId} has been cancelled.`, 'info');
      refreshAvailability().catch((error) => showToast(`Could not refresh availability: ${error.message}`, 'error'));
    } catch (error) {
      showToast(`Could not cancel booking: ${error.message}`, 'error');
    }
  };

  const handleAdminBookingDecision = async (bookingId, decision, adminNotes = '') => {
    try {
      const result = await apiRequest(`/api/bookings/${encodeURIComponent(bookingId)}/decision`, {
        method: 'PATCH',
        body: { decision, adminNotes },
      });
      const booking = normalizeBooking(result);
      setRoleBookings((previous) => previous.map((item) => item.id === booking.id ? booking : item));
      const logs = await apiRequest('/api/admin/audit-logs');
      setAuditLogs(logs.map(normalizeAuditLog));
      showToast(`Booking ${bookingId} marked as ${decision.toUpperCase()}.`, 'success');
      refreshAvailability().catch((error) => showToast(`Could not refresh availability: ${error.message}`, 'error'));
    } catch (error) {
      showToast(`Could not update booking: ${error.message}`, 'error');
    }
  };

  const handleSavePitch = async (pitch) => {
    const { isNew, ...form } = pitch;
    const payload = {
      code: form.code,
      name: form.name,
      location: form.location,
      surfaceType: form.surface,
      description: form.description,
      pricingNote: form.rateLabel,
      status: form.status,
      imageUrl: form.image,
      imagePublicId: form.imagePublicId,
    };
    try {
      const result = await apiRequest(
        isNew ? '/api/pitches' : `/api/pitches/${encodeURIComponent(form.id)}`,
        { method: isNew ? 'POST' : 'PATCH', body: payload }
      );
      const savedPitch = normalizePitch(result);
      setPitches((previous) => isNew
        ? [...previous, savedPitch]
        : previous.map((item) => item.id === savedPitch.id ? savedPitch : item));
      showToast(`${savedPitch.name} ${isNew ? 'added' : 'updated'} successfully.`, 'success');
      return true;
    } catch (error) {
      showToast(`Could not save pitch: ${error.message}`, 'error');
      return error.message;
    }
  };

  const handleProfileUpdate = async (profile) => {
    const result = await apiRequest('/api/auth/profile', { method: 'PATCH', body: profile });
    const user = normalizeUser(result.user);
    setCurrentUser(user);
    setUsers((previous) => previous.map((item) => item.id === user.id ? user : item));
    showToast('Profile information updated.', 'success');
  };

  const isDashboardLayout =
    (activePage === 'staff' && currentUser?.role === 'staff') ||
    (activePage === 'admin' && currentUser?.role === 'admin');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* MAIN TOP NAVBAR */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="text-left focus:outline-none"
          >
            <FrancoLogo />
          </button>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink active={activePage === 'home'} onClick={() => navigateTo('home')}>
              Home
            </NavLink>
            <NavLink active={activePage === 'about'} onClick={() => navigateTo('about')}>
              About
            </NavLink>
            <NavLink active={activePage === 'pitches'} onClick={() => navigateTo('pitches')}>
              Football Pitches (A–H)
            </NavLink>
            <NavLink active={activePage === 'facilities'} onClick={() => navigateTo('facilities')}>
              Sports Facilities
            </NavLink>
            {(!currentUser || currentUser.role === 'customer') && (
              <NavLink active={activePage === 'book'} onClick={() => navigateTo('book')}>
                Book a Pitch
              </NavLink>
            )}
            {currentUser?.role === 'customer' && (
              <NavLink active={activePage === 'dashboard'} onClick={() => navigateTo('dashboard')}>
                My Dashboard
              </NavLink>
            )}
            {currentUser?.role === 'staff' && (
              <NavLink active={activePage === 'staff'} onClick={() => navigateTo('staff')}>
                Staff Console
              </NavLink>
            )}
            {currentUser?.role === 'admin' && (
              <NavLink active={activePage === 'admin'} onClick={() => navigateTo('admin')}>
                Admin Console
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle Light/Dark Theme"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {!currentUser ? (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo('login')}
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('register')}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-xs transition"
                >
                  Register
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2.5">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] font-medium text-teal-700 dark:text-emerald-400 capitalize mt-0.5">
                    {currentUser.role}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log Out"
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              aria-label="Open Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-2">
            <MobileNavItem active={activePage === 'home'} onClick={() => navigateTo('home')}>
              Home
            </MobileNavItem>
            <MobileNavItem active={activePage === 'about'} onClick={() => navigateTo('about')}>
              About
            </MobileNavItem>
            <MobileNavItem active={activePage === 'pitches'} onClick={() => navigateTo('pitches')}>
              Football Pitches (A–H)
            </MobileNavItem>
            <MobileNavItem active={activePage === 'facilities'} onClick={() => navigateTo('facilities')}>
              Sports Facilities Directory
            </MobileNavItem>
            {(!currentUser || currentUser.role === 'customer') && (
              <MobileNavItem active={activePage === 'book'} onClick={() => navigateTo('book')}>
                Book a Football Pitch
              </MobileNavItem>
            )}
            {currentUser?.role === 'customer' && (
              <MobileNavItem active={activePage === 'dashboard'} onClick={() => navigateTo('dashboard')}>
                My Customer Dashboard
              </MobileNavItem>
            )}
            {currentUser?.role === 'staff' && (
              <MobileNavItem active={activePage === 'staff'} onClick={() => navigateTo('staff')}>
                Staff Operations Console
              </MobileNavItem>
            )}
            {currentUser?.role === 'admin' && (
              <MobileNavItem active={activePage === 'admin'} onClick={() => navigateTo('admin')}>
                Administrator Console
              </MobileNavItem>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              {!currentUser ? (
                <>
                  <button
                    onClick={() => navigateTo('login')}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => navigateTo('register')}
                    className="flex-1 py-2.5 rounded-xl bg-teal-700 dark:bg-emerald-600 text-white text-sm font-semibold"
                  >
                    Register
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold"
                >
                  Log Out ({currentUser.name})
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* TOAST NOTIFICATION BANNER */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] max-w-sm w-full px-4">
          <div
            className={`flex items-start gap-3 p-4 rounded-2xl shadow-xl border text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-rose-950 text-rose-100 border-rose-800'
                : toast.type === 'info'
                ? 'bg-slate-900 text-slate-100 border-slate-700'
                : 'bg-teal-950 text-emerald-100 border-emerald-800'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN PAGE ROUTER */}
      <main className="flex-1">
        {activePage === 'home' && (
          <HomePage
            pitches={pitches}
            navigateTo={navigateTo}
            onInspectPitch={setInspectedPitch}
          />
        )}

        {activePage === 'about' && <AboutPage />}

        {activePage === 'pitches' && (
          <PitchesDirectoryPage
            pitches={pitches}
            bookings={bookings}
            navigateTo={navigateTo}
            onInspectPitch={setInspectedPitch}
          />
        )}

        {activePage === 'book' && (
          <PitchBookingPage
            pitches={pitches}
            bookings={bookings}
            currentUser={currentUser}
            initialPitchId={selectedPitchIdForBooking}
            onSubmitBooking={handleCreateBooking}
            navigateTo={navigateTo}
          />
        )}

        {activePage === 'facilities' && (
          <FacilitiesDirectoryPage
            facilities={facilities}
            onInspectFacility={setInspectedFacility}
          />
        )}

        {(activePage === 'login' || activePage === 'register' || activePage === 'forgot-password') && (
          <AuthPages
            mode={activePage}
            onAuthenticate={handleAuthenticate}
            navigateTo={navigateTo}
            showToast={showToast}
          />
        )}

        {activePage === 'dashboard' && currentUser?.role === 'customer' && (
          <CustomerDashboardPage
            currentUser={currentUser}
            onProfileUpdate={handleProfileUpdate}
            bookings={bookings}
            pitches={pitches}
            onCancelBooking={handleCustomerCancelBooking}
            navigateTo={navigateTo}
            showToast={showToast}
          />
        )}

        {activePage === 'staff' && currentUser?.role === 'staff' && (
          <StaffDashboardPage
            currentUser={currentUser}
            pitches={pitches}
            onSavePitch={handleSavePitch}
            facilities={facilities}
            bookings={bookings}
            onInspectFacility={setInspectedFacility}
            showToast={showToast}
          />
        )}

        {activePage === 'admin' && currentUser?.role === 'admin' && (
          <AdminDashboardPage
            currentUser={currentUser}
            pitches={pitches}
            onSavePitch={handleSavePitch}
            facilities={facilities}
            setFacilities={setFacilities}
            bookings={bookings}
            users={users}
            setUsers={setUsers}
            auditLogs={auditLogs}
            onBookingDecision={handleAdminBookingDecision}
            showToast={showToast}
          />
        )}
      </main>

      {inspectedPitch && (
        <PitchDetailModal
          pitch={inspectedPitch}
          bookings={bookings}
          onClose={() => setInspectedPitch(null)}
          onBook={(pitchId) => {
            setInspectedPitch(null);
            navigateTo('book', pitchId);
          }}
        />
      )}

      {inspectedFacility && (
        <FacilityDetailModal
          facility={inspectedFacility}
          onClose={() => setInspectedFacility(null)}
        />
      )}

      {!isDashboardLayout && <Footer navigateTo={navigateTo} />}
    </div>
  );
}

const NavLink = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
      active
        ? 'bg-teal-50 text-teal-800 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
    }`}
  >
    {children}
  </button>
);

const MobileNavItem = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold block ${
      active
        ? 'bg-teal-50 text-teal-800 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`}
  >
    {children}
  </button>
);

// ============================================================================
// 4. PUBLIC HOMEPAGE
// ============================================================================

function HomePage({ pitches, navigateTo, onInspectPitch }) {
  const featuredPitches = pitches.filter((p) => p.status === 'active').slice(0, 3);

  const sportCategories = [
    {
      id: 'basketball',
      name: 'Basketball Courts',
      desc: 'Indoor hardwood arena & floodlit outdoor courts.',
      tag: 'Information-Only',
    },
    {
      id: 'table_tennis',
      name: 'Table Tennis',
      desc: 'ITTF-standard tables in the Student Activity Pavilion.',
      tag: 'Information-Only',
    },
    {
      id: 'lawn_tennis',
      name: 'Lawn Tennis Courts',
      desc: 'Four hard-surface racquet courts at West Campus.',
      tag: 'Information-Only',
    },
    {
      id: 'swimming_pool',
      name: 'Swimming Pools',
      desc: 'Supervised 50m Olympic aquatic lanes & locker rooms.',
      tag: 'Information-Only',
    },
    {
      id: 'gym',
      name: 'Strength & Fitness Gyms',
      desc: 'Olympic lifting platforms, cardio decks & free weights.',
      tag: 'Information-Only',
    },
  ];

  return (
    <div>
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=80"
            alt="University Football Stadium Pitch"
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-900/50" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-6">
              <ShieldCheck className="w-4 h-4" />
              Official University Sports Management Platform
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Modern Campus Sports Discovery &{' '}
              <span className="text-emerald-400">Football Pitch Booking</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed">
              Check real-time availability across Football Pitches A–H, submit verified match
              requests online, and explore university athletics facilities from one central portal.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => navigateTo('book')}
                className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-950/50 inline-flex items-center gap-2 transition"
              >
                <Calendar className="w-5 h-5" />
                Book a Football Pitch
              </button>
              <button
                type="button"
                onClick={() => navigateTo('facilities')}
                className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base inline-flex items-center gap-2 backdrop-blur-xs transition"
              >
                Explore Sports Facilities
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 pt-8 border-t border-white/10 max-w-lg">
              <div>
                <div className="text-2xl font-extrabold text-white tabular-nums">8 Pitches</div>
                <div className="text-xs text-slate-400 mt-0.5">Pitches A–H Online Booking</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">Zero</div>
                <div className="text-xs text-slate-400 mt-0.5">Double-Booking Conflicts</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white tabular-nums">5 Sports</div>
                <div className="text-xs text-slate-400 mt-0.5">Directory Categories</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED FOOTBALL PITCHES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
              Online Reservation Engine
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
              Featured Football Pitches
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Football is exclusively enabled for online slot requests across Pitches A through H.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('pitches')}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 dark:text-emerald-400 hover:underline"
          >
            View All 8 Pitches (A–H) <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredPitches.map((pitch) => (
            <div
              key={pitch.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
            >
              <div className="relative h-48">
                <ImageWithFallback
                  src={pitch.image}
                  alt={pitch.name}
                  className="w-full h-full"
                  fallbackLabel={pitch.name}
                />
                <div className="absolute top-3 right-3">
                  <StatusBadge status={pitch.status} />
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{pitch.name}</h3>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {pitch.capacity}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-emerald-400 shrink-0" />
                  {pitch.location}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 line-clamp-2 flex-1">
                  {pitch.description}
                </p>
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onInspectPitch(pitch)}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('book', pitch.id)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold transition"
                  >
                    Book Pitch
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* OTHER SPORTS FACILITIES CATEGORIES */}
      <section className="bg-slate-100/80 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
                Campus Athletics Directory
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
                Multi-Sport Facilities Directory
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Browse locations, operating hours, equipment, and guidelines. Information-only in Version 1.0.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('facilities')}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 dark:text-emerald-400 hover:underline"
            >
              Open Full Directory <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {sportCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigateTo('facilities')}
                className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-teal-600 dark:hover:border-emerald-500 transition shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-emerald-500/15 text-teal-700 dark:text-emerald-400 flex items-center justify-center mb-4">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{cat.name}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {cat.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {cat.tag}
                  </span>
                  <ChevronRight className="w-4 h-4 text-teal-700 dark:text-emerald-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* HOW FOOTBALL BOOKING WORKS + WHY FRANCO SPORTS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            How Football Pitch Booking Works
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Transparent, conflict-free scheduling backed by administrative verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Select Pitch & Open Slot',
              desc: 'Sign in with your student or community account, choose any Active pitch (A–H), and select an unoccupied future date and time window.',
            },
            {
              step: '02',
              title: 'Submit Request for Review',
              desc: 'Your slot is immediately locked against overlapping requests with a Pending status while Sports Administrators verify your match details.',
            },
            {
              step: '03',
              title: 'Track Decision in Dashboard',
              desc: 'Receive clear Approved or Rejected updates in your personal dashboard, or cancel Pending requests anytime before approval.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
            >
              <span className="inline-block px-3 py-1 rounded-lg bg-teal-50 dark:bg-emerald-500/15 text-teal-700 dark:text-emerald-400 font-extrabold text-xs tabular-nums">
                STEP {item.step}
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">{item.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-teal-900 dark:bg-slate-900 border border-teal-800 dark:border-slate-800 rounded-3xl p-8 sm:p-10 text-white grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold">Why Use Franco Sports?</h3>
            <p className="text-sm text-teal-100/80 dark:text-slate-400 mt-2">
              Built specifically for university athletics governance, eliminating manual paperwork and pitch disputes.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Real-Time Conflict Blocking</div>
                <p className="text-xs text-teal-100/75 dark:text-slate-400 mt-0.5">
                  Occupied slots are visually blocked so teams never waste time requesting taken hours.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Verified Administrative Oversight</div>
                <p className="text-xs text-teal-100/75 dark:text-slate-400 mt-0.5">
                  Every pitch allocation is reviewed by authorized sports management officers.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Complete Campus Directory</div>
                <p className="text-xs text-teal-100/75 dark:text-slate-400 mt-0.5">
                  Up-to-date hours and equipment specs for Basketball, Tennis, Aquatics, and Gyms.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Mobile-First Campus Access</div>
                <p className="text-xs text-teal-100/75 dark:text-slate-400 mt-0.5">
                  Check pitch status or cancel pending requests directly from your phone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 5. ABOUT PAGE + FOOTBALL PITCHES DIRECTORY PAGE (PITCH A–H)
// ============================================================================

function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="max-w-3xl mb-8 sm:mb-10">
        <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
          About the Platform
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
          Franco Sports
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
          Franco Sports brings university sports facility discovery and football pitch booking
          together in one place, with clear availability and a straightforward reservation process.
        </p>
      </div>

      <section
        aria-labelledby="about-developer-heading"
        className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
          Developer
        </p>
        <h2
          id="about-developer-heading"
          className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2"
        >
          Chinedu Gabriel Ebubechukwu
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Developer of the Franco Sports Facility and Pitch Booking System.
        </p>
      </section>
    </div>
  );
}

function PitchesDirectoryPage({ pitches, bookings, navigateTo, onInspectPitch }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredPitches = useMemo(() => {
    return pitches.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesQuery =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.location.toLowerCase().includes(search.toLowerCase()) ||
        p.surface.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesQuery;
    });
  }, [pitches, search, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
            Online Booking Enabled
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Football Pitches ({pitches.length} Pitches)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Select an Active pitch to view availability schedules or submit an online booking request.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pitch, turf, location..."
              className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {[
              { id: 'all', label: `All (${pitches.length})` },
              { id: 'active', label: 'Active' },
              { id: 'maintenance', label: 'Maintenance' },
              { id: 'inactive', label: 'Inactive' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === tab.id
                    ? 'bg-teal-700 dark:bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredPitches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <Trophy className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No matching football pitches</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Adjust your search query or reset the operational status filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredPitches.map((pitch) => {
            const upcomingCount = bookings.filter(
              (b) =>
                b.pitchId === pitch.id &&
                b.date >= TODAY_STR &&
                (b.status === 'approved' || b.status === 'pending')
            ).length;

            const isBookable = pitch.status === 'active';

            return (
              <div
                key={pitch.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs flex flex-col"
              >
                <div className="relative h-44">
                  <ImageWithFallback
                    src={pitch.image}
                    alt={pitch.name}
                    className="w-full h-full"
                    fallbackLabel={pitch.name}
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 text-white text-xs font-bold backdrop-blur-xs">
                      {pitch.code}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={pitch.status} />
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{pitch.name}</h3>
                  <p className="text-xs font-medium text-teal-700 dark:text-emerald-400 mt-0.5">
                    {pitch.surface} • {pitch.capacity}
                  </p>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 flex-1">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{pitch.location}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{pitch.rateLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="tabular-nums">{upcomingCount} active/pending slot(s) scheduled</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectPitch(pitch)}
                      className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      disabled={!isBookable}
                      onClick={() => navigateTo('book', pitch.id)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
                        isBookable
                          ? 'bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isBookable ? 'Book Pitch' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. FOOTBALL PITCH BOOKING PAGE (CONFLICT-AWARE INTERACTIVE FLOW)
// ============================================================================

function PitchBookingPage({
  pitches,
  bookings,
  currentUser,
  initialPitchId,
  onSubmitBooking,
  navigateTo,
}) {
  const activePitches = useMemo(() => pitches.filter((p) => p.status === 'active'), [pitches]);

  const [pitchId, setPitchId] = useState(initialPitchId || '');
  const effectivePitchId = pitches.some((p) => p.id === pitchId && p.status === 'active')
    ? pitchId
    : pitches.find((p) => p.id === initialPitchId && p.status === 'active')?.id
      || activePitches[0]?.id
      || '';
  const [date, setDate] = useState(TOMORROW_STR);
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(11);
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || '');
  const [purpose, setPurpose] = useState('');
  const [formError, setFormError] = useState('');
  const [submittedBooking, setSubmittedBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPitch = pitches.find((p) => p.id === effectivePitchId) || activePitches[0];

  const dayBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.pitchId === effectivePitchId &&
        b.date === date &&
        (b.status === 'pending' || b.status === 'approved')
    );
  }, [bookings, effectivePitchId, date]);

  const getHourOccupant = (hour) => {
    return dayBookings.find((b) => hour >= b.startHour && hour < b.endHour) || null;
  };

  const selectionHasConflict = useMemo(() => {
    if (endHour <= startHour) return true;
    for (let h = startHour; h < endHour; h++) {
      if (dayBookings.some((booking) => h >= booking.startHour && h < booking.endHour)) return true;
    }
    return false;
  }, [startHour, endHour, dayBookings]);

  const handleSlotChipClick = (hour) => {
    if (getHourOccupant(hour)) return;
    setStartHour(hour);
    setEndHour(hour + 1);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!currentUser) {
      navigateTo('login');
      return;
    }

    if (!contactPhone.trim()) {
      setFormError('Please provide a valid contact phone number.');
      return;
    }
    if (!purpose.trim() || purpose.trim().length < 5) {
      setFormError('Please enter a clear booking purpose (e.g., Departmental friendly match).');
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmitBooking({
        pitchId: effectivePitchId,
        date,
        startHour: Number(startHour),
        endHour: Number(endHour),
        contactPhone: contactPhone.trim(),
        purpose: purpose.trim(),
      });

      if (!result.ok) {
        setFormError(result.error);
      } else {
        setSubmittedBooking(result.booking);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedBooking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-14">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8" />
          </div>
          <StatusBadge status="pending" />
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-4">
            Booking Request Submitted
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
            Reference <span className="font-bold tabular-nums">{submittedBooking.id}</span> has been
            recorded and is now awaiting <strong>Administrator approval</strong>. Your selected time
            slot is held against overlapping requests.
          </p>

          <div className="mt-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 text-left text-sm space-y-2.5 border border-slate-200/70 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Pitch:</span>
              <span className="font-bold">{selectedPitch?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Date:</span>
              <span className="font-bold tabular-nums">{submittedBooking.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Time Slot:</span>
              <span className="font-bold tabular-nums">
                {formatHour(submittedBooking.startHour)} – {formatHour(submittedBooking.endHour)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Purpose:</span>
              <span className="font-medium text-right max-w-xs">{submittedBooking.purpose}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigateTo('dashboard')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold transition"
            >
              Track in My Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmittedBooking(null);
                setPurpose('');
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
          Football Pitch Reservation
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
          Request a Football Pitch Slot
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Only football pitches A–H are available for online booking. All requests require Administrator approval.
        </p>
      </div>

      {!currentUser && (
        <div className="mb-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Authentication Required to Submit a Booking
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-0.5">
                You can inspect live pitch availability below, but you must sign in as a Customer to submit a booking request.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('login')}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 transition"
          >
            Log In / Register
          </button>
        </div>
      )}

      {currentUser && currentUser.role !== 'customer' && (
        <div className="mb-8 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-3 text-sm">
          <Info className="w-5 h-5 text-teal-700 dark:text-emerald-400 shrink-0" />
          <span>
            You are currently signed in as <strong>{currentUser.role.toUpperCase()}</strong>. Only{' '}
            <strong>Customer</strong> accounts submit pitch booking requests.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* Step 1: Select Active Pitch */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-700 dark:bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
                1
              </span>
              Select Active Football Pitch
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Pitches currently in Maintenance or Inactive status are excluded from selection.
            </p>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pitches.map((p) => {
                const disabled = p.status !== 'active';
                const selected = p.id === effectivePitchId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setPitchId(p.id);
                      setFormError('');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      disabled
                        ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                        : selected
                        ? 'border-teal-700 dark:border-emerald-500 bg-teal-50/70 dark:bg-emerald-500/15 ring-1 ring-teal-700 dark:ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</span>
                      {disabled && (
                        <span className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                          {p.status}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      {p.capacity}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Date & Visual Slot Availability */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-700 dark:bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              Select Date & Inspect Slot Availability
            </h2>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Booking Date (Future Dates Only)
                </label>
                <input
                  type="date"
                  min={TODAY_STR}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setFormError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm tabular-nums"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Start Time
                </label>
                <select
                  value={startHour}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setStartHour(val);
                    if (endHour <= val) setEndHour(val + 1);
                    setFormError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm tabular-nums"
                >
                  {OPERATING_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  End Time
                </label>
                <select
                  value={endHour}
                  onChange={(e) => {
                    setEndHour(Number(e.target.value));
                    setFormError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm tabular-nums"
                >
                  {OPERATING_HOURS.filter((h) => h >= startHour).map((h) => (
                    <option key={h + 1} value={h + 1}>
                      {formatHour(h + 1)} ({h + 1 - startHour} hr{h + 1 - startHour > 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {selectedPitch?.name} Hourly Availability on {date}:
                </span>
                <div className="flex items-center gap-3 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Pending Hold
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Approved / Booked
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {OPERATING_HOURS.map((hour) => {
                  const occupant = getHourOccupant(hour);
                  const isSelected = !occupant && hour >= startHour && hour < endHour;

                  let slotStyle =
                    'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 hover:border-emerald-500 cursor-pointer';
                  let statusText = 'Open';

                  if (occupant?.status === 'approved') {
                    slotStyle =
                      'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 cursor-not-allowed opacity-80';
                    statusText = 'Approved';
                  } else if (occupant?.status === 'pending') {
                    slotStyle =
                      'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 cursor-not-allowed opacity-85';
                    statusText = 'Pending';
                  } else if (isSelected) {
                    slotStyle =
                      'bg-teal-700 dark:bg-emerald-600 border-teal-800 dark:border-emerald-400 text-white font-bold shadow-xs';
                    statusText = 'Selected';
                  }

                  return (
                    <button
                      key={hour}
                      type="button"
                      disabled={Boolean(occupant)}
                      onClick={() => handleSlotChipClick(hour)}
                      className={`p-2.5 rounded-xl border text-center transition ${slotStyle}`}
                    >
                      <div className="text-xs font-bold tabular-nums">
                        {formatHour(hour)}
                      </div>
                      <div className="text-[10px] mt-0.5 font-medium">{statusText}</div>
                    </button>
                  );
                })}
              </div>

              {selectionHasConflict && (
                <div className="mt-3 text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Your selected time window overlaps an already Pending or Approved slot. Choose open hours above.
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Contact & Booking Purpose */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-700 dark:bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              Contact & Match Details
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="e.g., +234 800 000 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Booking Purpose / Event Description *
                </label>
                <textarea
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Specify team names, departmental fixture, or training session details..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  required
                />
              </div>
            </div>

            {formError && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
          </div>
        </form>

        {/* RIGHT COLUMN: STICKY REVIEW & SUBMIT CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sticky top-24 shadow-xs">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Booking Summary</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review details carefully before submitting.
          </p>

          <div className="mt-5 space-y-3 text-sm border-y border-slate-100 dark:border-slate-800 py-4">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Selected Pitch</span>
              <span className="font-bold text-slate-900 dark:text-white">{selectedPitch?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Location</span>
              <span className="font-medium text-right max-w-[180px] text-xs">
                {selectedPitch?.location}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Date</span>
              <span className="font-bold tabular-nums">{date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Time Window</span>
              <span className="font-bold tabular-nums text-teal-700 dark:text-emerald-400">
                {formatHour(startHour)} – {formatHour(endHour)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Duration</span>
              <span className="font-semibold tabular-nums">
                {Math.max(1, endHour - startHour)} Hour(s)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Fee Policy</span>
              <span className="text-xs font-medium text-right max-w-[170px]">
                {selectedPitch?.rateLabel}
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-teal-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              No online payment is collected. Your request will enter as <strong>Pending</strong> until approved by an Administrator.
            </span>
          </div>

          <button
            type="button"
            disabled={submitting || selectionHasConflict || (currentUser && currentUser.role !== 'customer')}
            onClick={handleSubmit}
            className={`mt-5 w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-sm transition ${
              submitting || selectionHasConflict || (currentUser && currentUser.role !== 'customer')
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white'
            }`}
          >
            {!currentUser ? 'Log In to Submit Request' : submitting ? 'Submitting Request...' : 'Submit Booking Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. SPORTS FACILITIES DIRECTORY (INFORMATION-ONLY — 5 CATEGORIES)
// ============================================================================

function FacilitiesDirectoryPage({ facilities, onInspectFacility }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [search, setSearch] = useState('');

  const activeFacilities = useMemo(
    () => facilities.filter((f) => f.isActive),
    [facilities]
  );

  const uniqueLocations = useMemo(() => {
    const locs = Array.from(new Set(activeFacilities.map((f) => f.location)));
    return locs;
  }, [activeFacilities]);

  const filteredFacilities = useMemo(() => {
    return activeFacilities.filter((f) => {
      const matchCat = selectedCategory === 'all' || f.category === selectedCategory;
      const matchLoc = locationFilter === 'all' || f.location === locationFilter;
      const matchQuery =
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.description.toLowerCase().includes(search.toLowerCase()) ||
        f.equipment.some((eq) => eq.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchLoc && matchQuery;
    });
  }, [activeFacilities, selectedCategory, locationFilter, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
          Campus Athletics Catalog
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
          Other Sports Facilities Directory
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Explore university Basketball courts, Table Tennis halls, Lawn Tennis courts, Swimming Pools, and Gyms.
        </p>
      </div>

      <div className="mb-8 bg-teal-50/80 dark:bg-emerald-950/30 border border-teal-200 dark:border-emerald-800/60 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-teal-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-teal-950 dark:text-emerald-200">
          <strong>Information-Only Directory:</strong> Basketball, Table Tennis, Lawn Tennis, Swimming Pool, and Gym facilities do not support online booking or online payment in Version 1.0. Please consult the listed operating hours and facility desk contacts for access.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FACILITY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border ${
              selectedCategory === cat.id
                ? 'bg-teal-700 dark:bg-emerald-600 text-white border-teal-700 dark:border-emerald-600 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facility name, equipment (e.g., hardwood, 50m pool, weights)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
        </div>
        <div>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          >
            <option value="all">All Campus Locations</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredFacilities.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <Dumbbell className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold">No facilities match your filters</h3>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setLocationFilter('all');
              setSearch('');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFacilities.map((fac) => {
            const catLabel =
              FACILITY_CATEGORIES.find((c) => c.id === fac.category)?.label || fac.category;
            return (
              <div
                key={fac.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs flex flex-col"
              >
                <div className="relative h-48">
                  <ImageWithFallback
                    src={fac.image}
                    alt={fac.name}
                    className="w-full h-full"
                    fallbackLabel={fac.name}
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 text-white text-xs font-semibold backdrop-blur-xs">
                      {catLabel}
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <span className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-200 text-[11px] font-bold shadow-xs">
                      Information-Only
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{fac.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5 mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{fac.location}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5 mt-1">
                    <Clock className="w-3.5 h-3.5 text-teal-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{fac.operatingHours}</span>
                  </p>

                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 line-clamp-2 flex-1">
                    {fac.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {fac.equipment.slice(0, 3).map((eq) => (
                      <span
                        key={eq}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                      >
                        {eq}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => onInspectFacility(fac)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      View Facility Information <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 8. AUTHENTICATION PAGES (LOGIN, REGISTER [CUSTOMER ONLY], FORGOT PASSWORD)
// ============================================================================

function AuthPages({ mode, onAuthenticate, navigateTo, showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'forgot-password') {
      if (!email.trim()) {
        setError('Please enter your registered email address.');
        return;
      }
      setResetSent(true);
      showToast('Password recovery instructions sent if account exists.', 'success');
      return;
    }

    if (mode === 'register') {
      if (!fullName.trim() || !email.trim() || password.length < 6) {
        setError('Please complete all required fields (password minimum 6 characters).');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onAuthenticate(mode, {
        ...(mode === 'register' ? { fullName: fullName.trim(), phone: phone.trim() } : {}),
        email: email.trim(),
        password,
      });
    } catch (authError) {
      setError(authError.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/unn-logo.png"
            alt="University of Nigeria, Nsukka"
            className="h-10 w-10 object-contain rounded-full bg-white p-0.5 shadow-sm"
          />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {mode === 'login' && 'Franco Sports'}
              {mode === 'register' && 'Franco Sports'}
              {mode === 'forgot-password' && 'Reset Your Password'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              University of Nigeria, Nsukka
            </p>
          </div>
        </div>
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {mode === 'login' && 'Sign In to Franco Sports'}
            {mode === 'register' && 'Create Customer Account'}
            {mode === 'forgot-password' && 'Reset Your Password'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'login' && 'Sign in with your Customer, Staff, or Administrator credentials.'}
            {mode === 'register' &&
              'Public registration creates a Customer profile for requesting football pitches.'}
            {mode === 'forgot-password' &&
              'Enter your university or registered email to receive a password recovery link.'}
          </p>
        </div>

        {resetSent && mode === 'forgot-password' ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-sm text-emerald-900 dark:text-emerald-200">
            Recovery link dispatched to <strong>{email}</strong>. Check your inbox and return to log in.
            <button
              type="button"
              onClick={() => {
                setResetSent(false);
                navigateTo('login');
              }}
              className="mt-4 w-full py-2.5 rounded-xl bg-teal-700 text-white font-semibold text-xs"
            >
              Return to Log In
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Chinedu Okafor"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@sample-uni.edu"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                required
              />
            </div>

            {mode !== 'forgot-password' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold">Password *</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => navigateTo('forgot-password')}
                      className="text-xs font-semibold text-teal-700 dark:text-emerald-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                      : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-sm transition"
            >
              {mode === 'login' && (submitting ? 'Signing In...' : 'Sign In')}
              {mode === 'register' && (submitting ? 'Creating Account...' : 'Register Customer Account')}
              {mode === 'forgot-password' && 'Send Recovery Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-500">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => navigateTo('register')}
                className="font-bold text-teal-700 dark:text-emerald-400 hover:underline"
              >
                Register here
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigateTo('login')}
                className="font-bold text-teal-700 dark:text-emerald-400 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
        {mode === 'login' && (
          <p className="mt-5 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Developed by Chinedu Gabriel Ebubechukwu
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 9. CUSTOMER DASHBOARD (BOOKING SUMMARY, HISTORY, CANCEL PENDING, PROFILE)
// ============================================================================

function CustomerDashboardPage({
  currentUser,
  onProfileUpdate,
  bookings,
  pitches,
  onCancelBooking,
  navigateTo,
  showToast,
}) {
  const [activeTab, setActiveTab] = useState('bookings');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelTargetId, setCancelTargetId] = useState(null);

  const [profileName, setProfileName] = useState(currentUser.name);
  const [profilePhone, setProfilePhone] = useState(currentUser.phone);

  const myBookings = useMemo(
    () => bookings.filter((b) => b.customerId === currentUser.id),
    [bookings, currentUser.id]
  );

  const counts = useMemo(
    () => ({
      pending: myBookings.filter((b) => b.status === 'pending').length,
      approved: myBookings.filter((b) => b.status === 'approved').length,
      rejected: myBookings.filter((b) => b.status === 'rejected').length,
      cancelled: myBookings.filter((b) => b.status === 'cancelled').length,
    }),
    [myBookings]
  );

  const filteredBookings = useMemo(() => {
    if (statusFilter === 'all') return myBookings;
    return myBookings.filter((b) => b.status === statusFilter);
  }, [myBookings, statusFilter]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    try {
      await onProfileUpdate({ fullName: profileName.trim(), phone: profilePhone.trim() });
    } catch (error) {
      showToast(`Could not update profile: ${error.message}`, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
            Customer Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Welcome, {currentUser.name}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Track your football pitch booking requests, cancel pending slots, or update your contact details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('book')}
          className="px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-bold inline-flex items-center gap-2 self-start sm:self-auto transition"
        >
          <Plus className="w-4 h-4" />
          New Pitch Booking
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending Review', count: counts.pending, status: 'pending' },
          { label: 'Approved Bookings', count: counts.approved, status: 'approved' },
          { label: 'Rejected Requests', count: counts.rejected, status: 'rejected' },
          { label: 'Cancelled Bookings', count: counts.cancelled, status: 'cancelled' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {card.label}
              </span>
              <StatusBadge status={card.status} />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tabular-nums">
              {card.count}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'bookings'
              ? 'border-teal-700 dark:border-emerald-400 text-teal-700 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          My Bookings & History ({myBookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'profile'
              ? 'border-teal-700 dark:border-emerald-400 text-teal-700 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Profile Information
        </button>
      </div>

      {activeTab === 'bookings' ? (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize border transition ${
                  statusFilter === st
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold">No bookings found under this filter</h3>
              <p className="text-xs text-slate-500 mt-1">
                Submit a football pitch reservation request to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((b) => {
                const pitch = pitches.find((p) => p.id === b.pitchId);
                return (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 tabular-nums">
                          {b.id}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {pitch?.name || b.pitchId}
                        </h3>
                        <StatusBadge status={b.status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {b.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {formatHour(b.startHour)} –{' '}
                          {formatHour(b.endHour)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        <strong>Purpose:</strong> {b.purpose}
                      </p>

                      {b.adminNotes && (
                        <p className="text-xs text-teal-700 dark:text-emerald-400 bg-teal-50/70 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg inline-block">
                          <strong>Admin Decision Note:</strong> {b.adminNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {b.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => setCancelTargetId(b.id)}
                          className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition"
                        >
                          Cancel Pending Request
                        </button>
                      )}
                      {b.status === 'approved' && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          Confirmed — Contact Admin to cancel
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <h3 className="text-lg font-bold">Permitted Profile Details</h3>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Email Address (Read-Only)</label>
            <input
              type="email"
              value={currentUser.email}
              disabled
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-sm text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Full Name</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Contact Phone Number</label>
            <input
              type="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 text-white text-xs font-bold"
          >
            Save Profile Changes
          </button>
        </form>
      )}

      <ConfirmModal
        isOpen={Boolean(cancelTargetId)}
        title="Cancel Pending Booking Request?"
        message="Are you sure you want to cancel this pending request? The time slot will immediately be released for other university teams."
        confirmLabel="Yes, Cancel Request"
        confirmVariant="danger"
        onConfirm={() => {
          onCancelBooking(cancelTargetId);
          setCancelTargetId(null);
        }}
        onCancel={() => setCancelTargetId(null)}
      />
    </div>
  );
}

// ============================================================================
// 10. STAFF DASHBOARD (READ-ONLY BOOKINGS + OPTIONAL DELEGATED PITCH MANAGER)
// ============================================================================

function StaffDashboardPage({
  currentUser,
  pitches,
  onSavePitch,
  facilities,
  bookings,
  onInspectFacility,
  showToast,
}) {
  const [section, setSection] = useState('bookings');
  const [pitchModalData, setPitchModalData] = useState(null);

  const canManagePitches = Boolean(currentUser?.canManagePitches);

  const handleSavePitch = async (savedPitch) => {
    if (!canManagePitches) {
      const message = 'Unauthorized: You do not have Pitch Management permission.';
      showToast(message, 'error');
      return message;
    }
    const result = await onSavePitch(savedPitch);
    if (result === true) setPitchModalData(null);
    return result;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Staff Operations
            </div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">{currentUser.name}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <Eye className="w-3.5 h-3.5" /> Bookings View-Only
              </span>
              {canManagePitches && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" /> Authorized Pitch Manager
                </span>
              )}
            </div>

            <nav className="mt-5 space-y-1">
              {[
                { id: 'bookings', label: 'Booking Schedules', icon: Calendar },
                {
                  id: 'pitches',
                  label: canManagePitches ? 'Manage Pitches' : 'Football Pitches',
                  icon: Trophy,
                },
                { id: 'facilities', label: 'Active Facilities', icon: Dumbbell },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                      section === item.id
                        ? 'bg-teal-700 dark:bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Staff Permission Policy:</strong> Approving, rejecting, or cancelling bookings is strictly restricted to Administrators.{' '}
              {canManagePitches
                ? 'Your account has been authorized by an Administrator to add and update football pitches.'
                : 'Pitch records are currently view-only for your account.'}
            </span>
          </div>

          {section === 'bookings' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-bold">All Pitch Booking Requests (View-Only)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Ref</th>
                      <th className="px-4 py-3">Pitch</th>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Requester</th>
                      <th className="px-4 py-3">Purpose</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bookings.map((b) => {
                      const pitch = pitches.find((p) => p.id === b.pitchId);
                      return (
                        <tr key={b.id}>
                          <td className="px-4 py-3.5 font-bold tabular-nums">{b.id}</td>
                          <td className="px-4 py-3.5 font-semibold">{pitch?.name}</td>
                          <td className="px-4 py-3.5 tabular-nums">
                            {b.date} • {formatHour(b.startHour)}–{formatHour(b.endHour)}
                          </td>
                          <td className="px-4 py-3.5">{b.customerName}</td>
                          <td className="px-4 py-3.5 max-w-xs truncate">{b.purpose}</td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={b.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'pitches' && (
            <div className="space-y-4">
              {canManagePitches && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">Football Pitch Inventory ({pitches.length})</h2>
                    <p className="text-xs text-slate-500">
                      Add new football pitches or upload updated pitch photography to Cloudinary.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPitchModalData({
                        isNew: true,
                        code: `PITCH-${String.fromCharCode(65 + pitches.length)}`,
                        name: `Pitch ${String.fromCharCode(65 + pitches.length)}`,
                        location: '',
                        surface: 'Natural Grass',
                        capacity: '11-a-side Full Pitch',
                        rateLabel: '',
                        status: 'active',
                        description: '',
                        image: '',
                        imagePublicId: '',
                      })
                    }
                    className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add New Pitch
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pitches.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <ImageWithFallback
                        src={p.image}
                        alt={p.name}
                        className="w-14 h-14 rounded-xl shrink-0"
                        fallbackLabel={p.code}
                      />
                      <div>
                        <div className="font-bold text-base">{p.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.location}</div>
                        <div className="text-xs text-slate-400 mt-1">{p.surface}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={p.status} />
                      {canManagePitches && (
                        <button
                          type="button"
                          onClick={() => setPitchModalData({ ...p, isNew: false })}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'facilities' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {facilities
                .filter((f) => f.isActive)
                .map((f) => (
                  <div
                    key={f.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[11px] font-bold uppercase text-teal-700 dark:text-emerald-400">
                        {f.category.replace('_', ' ')}
                      </span>
                      <h3 className="font-bold text-base mt-1">{f.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{f.operatingHours}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInspectFacility(f)}
                      className="mt-4 text-xs font-bold text-teal-700 dark:text-emerald-400 hover:underline self-start"
                    >
                      View Operational Details →
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {pitchModalData && (
        <PitchFormModal
          pitch={pitchModalData}
          onClose={() => setPitchModalData(null)}
          onSave={handleSavePitch}
        />
      )}
    </div>
  );
}

// ============================================================================
// 11. ADMINISTRATOR DASHBOARD (FULL MANAGEMENT CONSOLE)
// ============================================================================

function AdminDashboardPage({
  currentUser,
  pitches,
  onSavePitch,
  facilities,
  setFacilities,
  bookings,
  users,
  setUsers,
  auditLogs,
  onBookingDecision,
  showToast,
}) {
  const [tab, setTab] = useState('overview');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');

  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');

  const [editingPitch, setEditingPitch] = useState(null);
  const [editingFacility, setEditingFacility] = useState(null);
  const [facilitySaveError, setFacilitySaveError] = useState('');
  const [facilityToDelete, setFacilityToDelete] = useState(null);
  const [addingStaffModal, setAddingStaffModal] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    department: '',
    canManagePitches: false,
  });

  const stats = useMemo(
    () => ({
      pendingBookings: bookings.filter((b) => b.status === 'pending').length,
      approvedBookings: bookings.filter((b) => b.status === 'approved').length,
      activePitches: pitches.filter((p) => p.status === 'active').length,
      activeFacilities: facilities.filter((f) => f.isActive).length,
      totalUsers: users.length,
    }),
    [bookings, pitches, facilities, users]
  );

  const filteredBookings = useMemo(() => {
    if (bookingStatusFilter === 'all') return bookings;
    return bookings.filter((b) => b.status === bookingStatusFilter);
  }, [bookings, bookingStatusFilter]);

  const handleSavePitch = async (savedPitch) => {
    const result = await onSavePitch(savedPitch);
    if (result === true) setEditingPitch(null);
    return result;
  };

  const handleSaveFacility = async (e) => {
    e.preventDefault();
    setFacilitySaveError('');
    const isNew = editingFacility.isNew;
    const payload = {
      name: editingFacility.name,
      category: editingFacility.category,
      description: editingFacility.description,
      equipment: editingFacility.equipment || [],
      location: editingFacility.location,
      operatingHours: editingFacility.operatingHours,
      contactInfo: editingFacility.contactInfo || '',
      feeInfo: editingFacility.usageFee || '',
      isActive: editingFacility.isActive,
      imageUrl: editingFacility.image || '',
      imagePublicId: editingFacility.imagePublicId || '',
    };
    try {
      const result = await apiRequest(
        isNew ? '/api/facilities' : `/api/facilities/${encodeURIComponent(editingFacility.id)}`,
        { method: isNew ? 'POST' : 'PATCH', body: payload }
      );
      const facility = normalizeFacility(result);
      setFacilities((previous) => isNew
        ? [facility, ...previous]
        : previous.map((item) => item.id === facility.id ? facility : item));
      showToast(isNew ? 'New sports facility added to directory.' : 'Sports facility updated.', 'success');
      setEditingFacility(null);
    } catch (error) {
      setFacilitySaveError(error.message);
      showToast(`Could not save facility: ${error.message}`, 'error');
    }
  };

  const handleDeleteFacility = async () => {
    if (!facilityToDelete) return;
    try {
      await apiRequest(`/api/facilities/${encodeURIComponent(facilityToDelete.id)}`, { method: 'DELETE' });
      setFacilities((previous) => previous.filter((item) => item.id !== facilityToDelete.id));
      showToast('Sports facility deleted.', 'success');
      setFacilityToDelete(null);
    } catch (error) {
      showToast(`Could not delete facility: ${error.message}`, 'error');
    }
  };

  const updateUser = async (userId, changes, message) => {
    try {
      const result = await apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: changes,
      });
      const user = normalizeUser(result.user);
      setUsers((previous) => previous.map((item) => item.id === user.id ? user : item));
      showToast(message(user), 'success');
    } catch (error) {
      showToast(`Could not update user: ${error.message}`, 'error');
    }
  };

  const handleToggleUserStatus = (userId) => {
    if (userId === currentUser.id) {
      showToast('You cannot suspend your own active administrator account.', 'error');
      return;
    }
    const user = users.find((item) => item.id === userId);
    if (!user) return;
    const accountStatus = user.status === 'active' ? 'suspended' : 'active';
    updateUser(userId, { accountStatus }, () => 'User account status updated.');
  };

  const handleChangeUserRole = (userId, newRole) => {
    if (userId === currentUser.id) {
      showToast('You cannot demote your own administrator role here.', 'error');
      return;
    }
    updateUser(userId, { role: newRole }, (user) => `User role updated to ${user.role.toUpperCase()}.`);
  };

  const handleTogglePitchManagerPermission = (userId) => {
    const target = users.find((u) => u.id === userId);
    if (!target || target.role !== 'staff') return;
    const nextVal = !target.canManagePitches;
    updateUser(
      userId,
      { canManagePitches: nextVal },
      (user) => user.canManagePitches
        ? `${user.name} is now authorized to add and manage football pitches.`
        : `Pitch management authorization revoked for ${user.name}.`
    );
  };

  const handleCreateStaffAccount = async (e) => {
    e.preventDefault();
    const trimmedName = newStaffForm.name.trim();
    const trimmedEmail = newStaffForm.email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      showToast('Please enter both full name and official email for the staff member.', 'error');
      return;
    }
    if (newStaffForm.password && newStaffForm.password.length < 6) {
      showToast('Temporary password must contain at least 6 characters.', 'error');
      return;
    }

    try {
      const result = await apiRequest('/api/admin/users/staff', {
        method: 'POST',
        body: {
          fullName: trimmedName,
          email: trimmedEmail,
          password: newStaffForm.password,
          phone: newStaffForm.phone.trim(),
          department: newStaffForm.department.trim(),
          canManagePitches: Boolean(newStaffForm.canManagePitches),
        },
      });
      const staff = normalizeUser(result.user);
      setUsers((previous) => [staff, ...previous]);
      setNewStaffForm({ name: '', email: '', password: '', phone: '', department: '', canManagePitches: false });
      setAddingStaffModal(false);
      showToast(`Staff account created for ${staff.name}. Temporary password: ${result.temporaryPassword}`, 'success');
    } catch (error) {
      showToast(`Could not create staff account: ${error.message}`, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sticky top-24">
            <div className="px-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-emerald-400">
                Administrator Control
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                {currentUser.name}
              </div>
            </div>

            <nav className="mt-3 space-y-1">
              {[
                { id: 'overview', label: 'Overview & KPIs', icon: LayoutDashboard },
                {
                  id: 'bookings',
                  label: 'Booking Requests',
                  icon: ClipboardList,
                  badge: stats.pendingBookings,
                },
                { id: 'pitches', label: `Football Pitches (${pitches.length})`, icon: Trophy },
                { id: 'facilities', label: 'Sports Facilities CMS', icon: Dumbbell },
                { id: 'users', label: 'Users & Role Access', icon: Users },
                { id: 'audit', label: 'Booking Audit Logs', icon: History },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                      tab === item.id
                        ? 'bg-teal-700 dark:bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {item.badge > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                          tab === item.id
                            ? 'bg-white text-teal-800'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Pending Bookings', val: stats.pendingBookings, accent: 'text-amber-600' },
                  { label: 'Approved Bookings', val: stats.approvedBookings, accent: 'text-emerald-600' },
                  { label: 'Active Pitches', val: `${stats.activePitches}/${pitches.length}`, accent: 'text-teal-700 dark:text-emerald-400' },
                  { label: 'Active Facilities', val: stats.activeFacilities, accent: 'text-slate-900 dark:text-white' },
                  { label: 'Registered Users', val: stats.totalUsers, accent: 'text-slate-900 dark:text-white' },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4"
                  >
                    <div className="text-xs font-medium text-slate-500">{k.label}</div>
                    <div className={`text-2xl font-extrabold mt-2 tabular-nums ${k.accent}`}>
                      {k.val}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold">Recent Booking Activity & Audit Trail</h2>
                  <button
                    type="button"
                    onClick={() => setTab('bookings')}
                    className="text-xs font-bold text-teal-700 dark:text-emerald-400 hover:underline"
                  >
                    Manage All Bookings →
                  </button>
                </div>
                <div className="space-y-3">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {log.bookingId}
                        </span>{' '}
                        • <span className="font-semibold">{log.action}</span> by{' '}
                        <span>{log.actorName}</span> ({log.actorRole})
                        <p className="text-slate-500 mt-0.5">{log.notes}</p>
                      </div>
                      <span className="text-slate-400 tabular-nums shrink-0">{log.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>

              <section
                aria-labelledby="admin-project-information-heading"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
              >
                <h2
                  id="admin-project-information-heading"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  Project Information
                </h2>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">System</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                      Franco Sports Facility and Pitch Booking System
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Developer</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                      Chinedu Gabriel Ebubechukwu
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}

          {tab === 'bookings' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Football Pitch Booking Moderation</h2>
                  <p className="text-xs text-slate-500">
                    Approve or reject Pending requests, or cancel Approved bookings.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setBookingStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                        bookingStatusFilter === st
                          ? 'bg-teal-700 dark:bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBookings.map((b) => {
                  const pitch = pitches.find((p) => p.id === b.pitchId);
                  return (
                    <div
                      key={b.id}
                      className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 tabular-nums">
                            {b.id}
                          </span>
                          <span className="font-bold text-sm">{pitch?.name}</span>
                          <StatusBadge status={b.status} />
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                          <strong>Schedule:</strong> {b.date} | {formatHour(b.startHour)} –{' '}
                          {formatHour(b.endHour)}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <strong>Customer:</strong> {b.customerName} ({b.customerEmail} •{' '}
                          {b.contactPhone})
                        </div>
                        <div className="text-xs text-slate-500">
                          <strong>Purpose:</strong> {b.purpose}
                        </div>
                        {b.adminNotes && (
                          <div className="text-xs text-teal-700 dark:text-emerald-400">
                            <strong>Admin Note:</strong> {b.adminNotes}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {b.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setDecisionNote('');
                                setDecisionModal({ booking: b, decision: 'approved' });
                              }}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDecisionNote('');
                                setDecisionModal({ booking: b, decision: 'rejected' });
                              }}
                              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {b.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDecisionNote('');
                              setDecisionModal({ booking: b, decision: 'cancelled' });
                            }}
                            className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition"
                          >
                            Cancel Approved Booking
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'pitches' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Manage Football Pitches ({pitches.length} Total)</h2>
                  <p className="text-xs text-slate-500">
                    Add new pitches, upload photos from local storage to Cloudinary, and manage operational states.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingPitch({
                      isNew: true,
                      code: `PITCH-${String.fromCharCode(65 + pitches.length)}`,
                      name: `Pitch ${String.fromCharCode(65 + pitches.length)}`,
                      location: '',
                      surface: 'FIFA-Standard Synthetic Turf',
                      capacity: '11-a-side Full Pitch',
                      rateLabel: '',
                      status: 'active',
                      description: '',
                      image: '',
                      imagePublicId: '',
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add New Pitch
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pitches.map((p) => (
                  <div
                    key={p.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <ImageWithFallback
                        src={p.image}
                        alt={p.name}
                        className="w-16 h-16 rounded-xl shrink-0"
                        fallbackLabel={p.code}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                            {p.code}
                          </span>
                          <h3 className="font-bold text-base">{p.name}</h3>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{p.location}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{p.rateLabel}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingPitch({ ...p, isNew: false })}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-center"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Pitch & Photo
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'facilities' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Sports Facilities Directory Management</h2>
                  <p className="text-xs text-slate-500">
                    Manage information-only listings for Basketball, Table Tennis, Lawn Tennis, Swimming Pools, and Gyms.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFacilitySaveError('');
                    setEditingFacility({
                      isNew: true,
                      name: '',
                      category: 'basketball',
                      location: '',
                      operatingHours: '',
                      contactInfo: '',
                      usageFee: '',
                      equipment: [],
                      description: '',
                      isActive: true,
                      image: '',
                      imagePublicId: '',
                    });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add New Facility
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {facilities.map((fac) => (
                  <div
                    key={fac.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <ImageWithFallback
                        src={fac.image}
                        alt={fac.name}
                        className="w-16 h-16 rounded-xl shrink-0"
                        fallbackLabel={fac.name}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-sm">{fac.name}</h3>
                          <StatusBadge status={fac.isActive ? 'active' : 'inactive'} />
                        </div>
                        <p className="text-xs text-teal-700 dark:text-emerald-400 font-semibold capitalize mt-0.5">
                          {fac.category.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{fac.location}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setFacilitySaveError('');
                          setEditingFacility({ ...fac, isNew: false });
                        }}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const result = await apiRequest(`/api/facilities/${encodeURIComponent(fac.id)}`, {
                              method: 'PATCH',
                              body: { isActive: !fac.isActive },
                            });
                            const updated = normalizeFacility(result);
                            setFacilities((previous) => previous.map((item) => item.id === updated.id ? updated : item));
                            showToast(`Facility ${updated.isActive ? 'activated' : 'deactivated'}.`, 'info');
                          } catch (error) {
                            showToast(`Could not update facility: ${error.message}`, 'error');
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {fac.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFacilityToDelete(fac)}
                        className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">User Accounts & Role Permissions</h2>
                  <p className="text-xs text-slate-500">
                    Add new Staff members, suspend/reactivate accounts, assign protected roles, and delegate Pitch Management authorization.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewStaffForm({
                      name: '',
                      email: '',
                      password: '',
                      phone: '',
                      department: '',
                      canManagePitches: false,
                    });
                    setAddingStaffModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" /> Add New Staff Member
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">User & Department</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Pitch Creation Auth</th>
                      <th className="px-4 py-3">Account Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                          <div className="text-slate-500">{u.email}</div>
                          {u.department && (
                            <div className="text-[11px] text-slate-400 mt-0.5">{u.department}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <select
                            value={u.role}
                            disabled={u.id === currentUser.id}
                            onChange={(e) => handleChangeUserRole(u.id, e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 capitalize disabled:opacity-50"
                          >
                            <option value="customer">Customer</option>
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          {u.role === 'staff' ? (
                            <button
                              type="button"
                              onClick={() => handleTogglePitchManagerPermission(u.id)}
                              className={`px-2.5 py-1.5 rounded-lg font-semibold border ${
                                u.canManagePitches
                                  ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400'
                                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {u.canManagePitches ? 'Authorized' : 'View Only'}
                            </button>
                          ) : (
                            <span className="text-slate-400">{u.role === 'admin' ? 'Full access' : '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            disabled={u.id === currentUser.id}
                            onClick={() => handleToggleUserStatus(u.id)}
                            className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
                              u.id === currentUser.id
                                ? 'opacity-40 cursor-not-allowed border-slate-200'
                                : u.status === 'active'
                                ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400'
                            }`}
                          >
                            {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-bold">Immutable Booking Audit Logs</h2>
                <p className="text-xs text-slate-500">
                  Chronological record of all booking submissions, approvals, rejections, and cancellations.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Booking</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Transition</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3.5 tabular-nums text-slate-500">{log.timestamp}</td>
                        <td className="px-4 py-3.5 font-bold tabular-nums">{log.bookingId}</td>
                        <td className="px-4 py-3.5 font-bold">{log.action}</td>
                        <td className="px-4 py-3.5">
                          {log.actorName}{' '}
                          <span className="text-slate-400 capitalize">({log.actorRole})</span>
                        </td>
                        <td className="px-4 py-3.5 capitalize">
                          {log.previousStatus} → <strong>{log.newStatus}</strong>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-xs">{log.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(decisionModal)}
        title={`Confirm Booking ${decisionModal?.decision?.toUpperCase()}`}
        message={`Update booking ${decisionModal?.booking?.id} (${decisionModal?.booking?.customerName}) to "${decisionModal?.decision}"? This decision will be recorded in the audit log.`}
        confirmLabel={`Confirm ${decisionModal?.decision || ''}`}
        confirmVariant={decisionModal?.decision === 'approved' ? 'primary' : 'danger'}
        onConfirm={() => {
          onBookingDecision(
            decisionModal.booking.id,
            decisionModal.decision,
            decisionNote.trim()
          );
          setDecisionModal(null);
        }}
        onCancel={() => setDecisionModal(null)}
      >
        <div>
          <label className="block text-xs font-semibold mb-1.5">
            Administrative Decision Note (Optional)
          </label>
          <input
            type="text"
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            placeholder="e.g., Approved with evening floodlights / Schedule conflict..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
        </div>
      </ConfirmModal>

      <ConfirmModal
        isOpen={Boolean(facilityToDelete)}
        title="Delete Sports Facility?"
        message={`Delete ${facilityToDelete?.name}? This action cannot be undone.`}
        confirmLabel="Delete Facility"
        confirmVariant="danger"
        onConfirm={handleDeleteFacility}
        onCancel={() => setFacilityToDelete(null)}
      />

      {editingPitch && (
        <PitchFormModal
          pitch={editingPitch}
          onClose={() => setEditingPitch(null)}
          onSave={handleSavePitch}
        />
      )}

      {addingStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <form
            onSubmit={handleCreateStaffAccount}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add New Staff Member
                </h3>
                <p className="text-xs text-slate-500">
                  Create an institutional Staff account (public registration is restricted to Customers).
                </p>
              </div>
              <button type="button" onClick={() => setAddingStaffModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Full Name *</label>
              <input
                type="text"
                value={newStaffForm.name}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                placeholder="e.g., Musa Abdullahi"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Official Email Address *</label>
              <input
                type="email"
                value={newStaffForm.email}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                placeholder="e.g., musa.abdullahi@francosports.sample"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Temporary Password (Optional)</label>
              <div className="relative">
                <input
                  type={showStaffPassword ? 'text' : 'password'}
                  minLength={6}
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowStaffPassword((visible) => !visible)}
                  aria-label={showStaffPassword ? 'Hide temporary password' : 'Show temporary password'}
                  aria-pressed={showStaffPassword}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showStaffPassword
                    ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                    : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Leave blank to use the server-generated temporary password.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newStaffForm.phone}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  placeholder="+234 800 000 0205"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Unit / Department</label>
                <input
                  type="text"
                  value={newStaffForm.department}
                  onChange={(e) =>
                    setNewStaffForm({ ...newStaffForm, department: e.target.value })
                  }
                  placeholder="e.g., Grounds & Maintenance"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newStaffForm.canManagePitches}
                onChange={(e) =>
                  setNewStaffForm({ ...newStaffForm, canManagePitches: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Authorize Football Pitch Management
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Allows this staff member to add new pitches, upload pitch photos to Cloudinary, and update pitch statuses. Booking approvals remain Admin-only.
                </span>
              </div>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddingStaffModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 text-white text-xs font-bold"
              >
                Create Staff Account
              </button>
            </div>
          </form>
        </div>
      )}

      {editingFacility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveFacility}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editingFacility.isNew ? 'Add Sports Facility' : 'Edit Sports Facility'}
              </h3>
              <button type="button" onClick={() => setEditingFacility(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Facility Name *</label>
              <input
                type="text"
                value={editingFacility.name}
                onChange={(e) => setEditingFacility({ ...editingFacility, name: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Sport Category *</label>
              <select
                value={editingFacility.category}
                onChange={(e) =>
                  setEditingFacility({ ...editingFacility, category: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              >
                <option value="basketball">Basketball Courts</option>
                <option value="table_tennis">Table Tennis</option>
                <option value="lawn_tennis">Lawn Tennis Courts</option>
                <option value="swimming_pool">Swimming Pools</option>
                <option value="gym">Gyms</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Location *</label>
                <input
                  type="text"
                  value={editingFacility.location}
                  onChange={(e) =>
                    setEditingFacility({ ...editingFacility, location: e.target.value })
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Operating Hours *</label>
                <input
                  type="text"
                  value={editingFacility.operatingHours}
                  onChange={(e) =>
                    setEditingFacility({ ...editingFacility, operatingHours: e.target.value })
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Contact & Usage Fee Info</label>
              <input
                type="text"
                value={editingFacility.usageFee}
                onChange={(e) =>
                  setEditingFacility({ ...editingFacility, usageFee: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <CloudinaryImageUploader
              folder="facilities"
              currentImage={editingFacility.image}
              currentPublicId={editingFacility.imagePublicId}
              onUploaded={({ imageUrl, imagePublicId }) =>
                setEditingFacility({
                  ...editingFacility,
                  image: imageUrl,
                  imagePublicId,
                })
              }
            />

            <div>
              <label className="block text-xs font-semibold mb-1">Description *</label>
              <textarea
                rows={3}
                value={editingFacility.description}
                onChange={(e) =>
                  setEditingFacility({ ...editingFacility, description: e.target.value })
                }
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            {facilitySaveError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {facilitySaveError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingFacility(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-700 dark:bg-emerald-600 text-white text-xs font-bold"
              >
                Save Facility
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 12. DETAIL MODALS & INSTITUTIONAL FOOTER
// ============================================================================

function PitchDetailModal({ pitch, bookings, onClose, onBook }) {
  const upcoming = bookings.filter(
    (b) =>
      b.pitchId === pitch.id &&
      b.date >= TODAY_STR &&
      (b.status === 'approved' || b.status === 'pending')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl">
        <div className="relative h-56">
          <ImageWithFallback
            src={pitch.image}
            alt={pitch.name}
            className="w-full h-full"
            fallbackLabel={pitch.name}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/70 text-white hover:bg-slate-950"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-4 left-4">
            <StatusBadge status={pitch.status} />
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{pitch.name}</h3>
            <p className="text-xs font-semibold text-teal-700 dark:text-emerald-400 mt-0.5">
              {pitch.surface} • {pitch.capacity}
            </p>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {pitch.description}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2 text-xs">
            <div>
              <strong>Location:</strong> {pitch.location}
            </div>
            <div>
              <strong>Fee Policy:</strong> {pitch.rateLabel}
            </div>
            <div>
              <strong>Scheduled Slots:</strong> {upcoming.length} upcoming Pending/Approved booking(s)
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
            >
              Close
            </button>
            {pitch.status === 'active' && (
              <button
                type="button"
                onClick={() => onBook(pitch.id)}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 text-white text-xs font-bold"
              >
                Book {pitch.name} Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FacilityDetailModal({ facility, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl">
        <div className="relative h-56">
          <ImageWithFallback
            src={facility.image}
            alt={facility.name}
            className="w-full h-full"
            fallbackLabel={facility.name}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/70 text-white hover:bg-slate-950"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase text-teal-700 dark:text-emerald-400">
                {facility.category.replace('_', ' ')}
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {facility.name}
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
              Information-Only
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {facility.description}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2 text-xs">
            <div>
              <strong>Location:</strong> {facility.location}
            </div>
            <div>
              <strong>Operating Hours:</strong> {facility.operatingHours}
            </div>
            <div>
              <strong>Contact Desk:</strong> {facility.contactInfo}
            </div>
            <div>
              <strong>Usage Policy:</strong> {facility.usageFee}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold mb-2">Available Equipment & Features:</div>
            <div className="flex flex-wrap gap-1.5">
              {facility.equipment.map((eq) => (
                <span
                  key={eq}
                  className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-emerald-500/15 text-teal-800 dark:text-emerald-300 text-xs font-medium"
                >
                  {eq}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer({ navigateTo }) {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <FrancoLogo size="sm" />
          <p className="text-xs text-slate-400 mt-4 leading-relaxed max-w-sm">
            Centralized university sports facility discovery and football pitch booking management system. All operational figures, addresses, and phone numbers shown are clearly marked sample placeholders.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
            Platform Navigation
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => navigateTo('home')} className="hover:text-emerald-400">
                Home
              </button>
            </li>
            <li>
              <button onClick={() => navigateTo('about')} className="hover:text-emerald-400">
                About
              </button>
            </li>
            <li>
              <button onClick={() => navigateTo('pitches')} className="hover:text-emerald-400">
                Football Pitches (A–H)
              </button>
            </li>
            <li>
              <button onClick={() => navigateTo('facilities')} className="hover:text-emerald-400">
                Sports Facilities Directory
              </button>
            </li>
            <li>
              <button onClick={() => navigateTo('book')} className="hover:text-emerald-400">
                Book a Football Pitch
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
            Sports Management Office [Sample]
          </h4>
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Franco Sports Directorate, University Main Campus [Sample]</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>+234 800 000 0000 [Sample Desk Line]</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>desk@francosports.sample</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-900 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-center sm:text-left text-[11px] text-slate-500">
        <span>© 2026 Franco Sports Management • Interactive UI Prototype (Version 1.0 Scope)</span>
        <span>Developed by Chinedu Gabriel Ebubechukwu</span>
      </div>
    </footer>
  );
}