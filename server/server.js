// 




import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [...new Set([
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
].filter(Boolean))];

// ==========================================
// 1. SUPABASE, CLOUDINARY & MIDDLEWARE SETUP
// ==========================================
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  },
});

// ==========================================
// 2. DATA FORMATTERS (DB SNAKE_CASE -> FRONTEND CAMELCASE)
// ==========================================
const signToken = (user) =>
  jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const formatUser = (u) => ({
  id: u.id,
  _id: u.id,
  fullName: u.full_name,
  email: u.email,
  phone: u.phone || '',
  department: u.department || '',
  role: u.role,
  accountStatus: u.account_status,
  canManagePitches: u.role === 'admin' ? true : Boolean(u.can_manage_pitches),
  createdAt: u.created_at,
});

const formatPitch = (p) => ({
  id: p.id,
  _id: p.id,
  code: p.code,
  name: p.name,
  slug: p.slug,
  location: p.location,
  surfaceType: p.surface_type,
  description: p.description,
  pricingNote: p.pricing_note || '',
  status: p.status,
  imageUrl: p.image_url || '',
  imagePublicId: p.image_public_id || '',
  createdAt: p.created_at,
});

const formatFacility = (f) => ({
  id: f.id,
  _id: f.id,
  name: f.name,
  slug: f.slug,
  category: f.category,
  description: f.description,
  equipment: Array.isArray(f.equipment) ? f.equipment : [],
  location: f.location,
  operatingHours: f.operating_hours,
  contactInfo: f.contact_info || '',
  feeInfo: f.fee_info || '',
  isActive: Boolean(f.is_active),
  imageUrl: f.image_url || '',
  imagePublicId: f.image_public_id || '',
  createdAt: f.created_at,
});

const formatBooking = (b) => ({
  id: b.id,
  _id: b.id,
  pitchId: b.pitch
    ? {
        id: b.pitch.id,
        _id: b.pitch.id,
        code: b.pitch.code,
        name: b.pitch.name,
        location: b.pitch.location,
        status: b.pitch.status,
      }
    : b.pitch_id,
  customerId: b.customer
    ? {
        id: b.customer.id,
        _id: b.customer.id,
        fullName: b.customer.full_name,
        email: b.customer.email,
        phone: b.customer.phone || '',
        department: b.customer.department || '',
      }
    : b.customer_id,
  bookingDate: b.booking_date,
  startHour: b.start_hour,
  endHour: b.end_hour,
  contactPhone: b.contact_phone,
  purpose: b.purpose,
  status: b.status,
  adminNotes: b.admin_notes || '',
  decidedBy: b.decided_by || null,
  decidedAt: b.decided_at || null,
  createdAt: b.created_at,
});

const formatAuditLog = (log) => ({
  id: log.id,
  _id: log.id,
  bookingId: log.booking_id,
  pitchName: log.pitch_name,
  actorId: log.actor_id,
  actorName: log.actor_name,
  actorRole: log.actor_role,
  action: log.action,
  previousStatus: log.previous_status,
  newStatus: log.new_status,
  notes: log.notes || '',
  createdAt: log.created_at,
});

// ==========================================
// 3. AUTHENTICATION & RBAC MIDDLEWARES
// ==========================================
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.sub)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'User account no longer exists.' });
    }
    if (user.account_status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended. Contact Franco Sports administration.' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session token.' });
  }
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: insufficient privileges.' });
  }
  next();
};

const requirePitchManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  const authorized =
    req.user.role === 'admin' || (req.user.role === 'staff' && req.user.can_manage_pitches);
  if (!authorized) {
    return res.status(403).json({ message: 'You are not authorized to add or edit football pitches.' });
  }
  next();
};

// ==========================================
// 4. AUTH ROUTES (PUBLIC SIGNUP = CUSTOMER ONLY)
// ==========================================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password, phone, department } = req.body;
    if (!fullName || !email || !password || password.length < 6) {
      return res.status(400).json({ message: 'Full name, valid email, and password (min 6 chars) are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        full_name: fullName.trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        phone: phone || '',
        department: department || '',
        role: 'customer',
        account_status: 'active',
        can_manage_pitches: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json({ token: signToken(user), user: formatUser(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });
    if (user.account_status === 'suspended') {
      return res.status(403).json({ message: 'This account has been suspended.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });

    return res.json({ token: signToken(user), user: formatUser(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Login failed.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'franco-sports-api' });
});

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'franco-sports-api' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: formatUser(req.user) });
});

app.patch('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { fullName, phone, department } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (fullName) updates.full_name = fullName.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (department !== undefined) updates.department = department.trim();

    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ user: formatUser(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 5. CLOUDINARY LOCAL-TO-CLOUD UPLOAD ROUTE
// ==========================================
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const folder = req.body.folder === 'pitches' ? 'franco-sports/pitches' : 'franco-sports/facilities';

    if (folder === 'franco-sports/pitches') {
      const canPitch =
        req.user.role === 'admin' || (req.user.role === 'staff' && req.user.can_manage_pitches);
      if (!canPitch) {
        return res.status(403).json({ message: 'Not authorized to upload pitch images.' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can upload facility images.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ width: 1400, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    return res.status(201).json({
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Cloudinary upload failed.' });
  }
});

// ==========================================
// 6. FOOTBALL PITCHES ROUTES (PITCHES A-H + NEW)
// ==========================================
app.get('/api/pitches', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('pitches').select('*').order('code', { ascending: true });
    if (error) throw error;
    res.json(data.map(formatPitch));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/pitches', requireAuth, requirePitchManager, async (req, res) => {
  try {
    const { code, name, location, surfaceType, description, pricingNote, status, imageUrl, imagePublicId } = req.body;
    if (!code || !name || !location || !description) {
      return res.status(400).json({ message: 'Code, name, location, and description are required.' });
    }

    const cleanCode = code.toUpperCase().trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: pitch, error } = await supabase
      .from('pitches')
      .insert({
        code: cleanCode,
        name: name.trim(),
        slug,
        location: location.trim(),
        surface_type: surfaceType || 'FIFA-Grade Synthetic Turf',
        description,
        pricing_note: pricingNote || '',
        status: status || 'active',
        image_url: imageUrl || '',
        image_public_id: imagePublicId || '',
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'A pitch with this code or name already exists.' });
      }
      throw error;
    }

    res.status(201).json(formatPitch(pitch));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/pitches/:id', requireAuth, requirePitchManager, async (req, res) => {
  try {
    const { data: existing } = await supabase.from('pitches').select('*').eq('id', req.params.id).maybeSingle();
    if (!existing) return res.status(404).json({ message: 'Pitch not found.' });

    const { code, name, location, surfaceType, description, pricingNote, status, imageUrl, imagePublicId } = req.body;

    if (imagePublicId && existing.image_public_id && imagePublicId !== existing.image_public_id) {
      await cloudinary.uploader.destroy(existing.image_public_id).catch(() => {});
    }

    const updates = { updated_at: new Date().toISOString() };
    if (code) updates.code = code.toUpperCase().trim();
    if (name) {
      updates.name = name.trim();
      updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (location) updates.location = location.trim();
    if (surfaceType !== undefined) updates.surface_type = surfaceType;
    if (description) updates.description = description;
    if (pricingNote !== undefined) updates.pricing_note = pricingNote;
    if (status && ['active', 'maintenance', 'inactive'].includes(status)) updates.status = status;
    if (imageUrl !== undefined) updates.image_url = imageUrl;
    if (imagePublicId !== undefined) updates.image_public_id = imagePublicId;

    const { data: updated, error } = await supabase
      .from('pitches')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json(formatPitch(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 7. FOOTBALL BOOKING ROUTES (POSTGRES GIST DOUBLE-BOOKING GUARD)
// ==========================================
app.get('/api/bookings/availability', async (req, res) => {
  try {
    const { pitchId, date } = req.query;
    let query = supabase
      .from('bookings')
      .select('id, pitch_id, booking_date, start_hour, end_hour, status')
      .in('status', ['pending', 'approved']);

    if (pitchId) query = query.eq('pitch_id', pitchId);
    if (date) query = query.eq('booking_date', date);

    const { data, error } = await query;
    if (error) throw error;

    res.json(
      data.map((s) => ({
        id: s.id,
        pitchId: s.pitch_id,
        bookingDate: s.booking_date,
        startHour: s.start_hour,
        endHour: s.end_hour,
        status: s.status,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        pitch:pitches(id, code, name, location, status),
        customer:users!bookings_customer_id_fkey(id, full_name, email, phone, department)
      `)
      .order('created_at', { ascending: false });

    if (req.user.role === 'customer') {
      query = query.eq('customer_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data.map(formatBooking));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/bookings', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const { pitchId, bookingDate, startHour, endHour, contactPhone, purpose } = req.body;
    if (!pitchId || !bookingDate || startHour === undefined || endHour === undefined || !contactPhone || !purpose) {
      return res.status(400).json({ message: 'All booking fields are required.' });
    }

    const start = Number(startHour);
    const end = Number(endHour);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start || start < 7 || end > 21) {
      return res.status(400).json({ message: 'Invalid booking hours. Allowed window is 07:00 to 21:00.' });
    }

    const bookingStartDateTime = new Date(`${bookingDate}T${String(start).padStart(2, '0')}:00:00`);
    if (Number.isNaN(bookingStartDateTime.getTime()) || bookingStartDateTime <= new Date()) {
      return res.status(400).json({ message: 'Bookings cannot start in the past.' });
    }

    const { data: pitch } = await supabase.from('pitches').select('*').eq('id', pitchId).maybeSingle();
    if (!pitch) return res.status(404).json({ message: 'Selected pitch not found.' });
    if (pitch.status !== 'active') {
      return res.status(400).json({ message: `${pitch.name} is currently ${pitch.status} and cannot be booked.` });
    }

    // PostgreSQL EXCLUDE USING gist constraint enforces zero overlap atomically (error 23P01)
    const { data: created, error } = await supabase
      .from('bookings')
      .insert({
        pitch_id: pitchId,
        customer_id: req.user.id,
        booking_date: bookingDate,
        start_hour: start,
        end_hour: end,
        contact_phone: contactPhone.trim(),
        purpose: purpose.trim(),
        status: 'pending',
      })
      .select(`
        *,
        pitch:pitches(id, code, name, location, status),
        customer:users!bookings_customer_id_fkey(id, full_name, email, phone, department)
      `)
      .single();

    if (error) {
      if (error.code === '23P01') {
        return res.status(409).json({
          message: 'Slot unavailable: another pending or approved booking already overlaps this time range on this pitch.',
        });
      }
      throw error;
    }

    await supabase.from('audit_logs').insert({
      booking_id: created.id,
      pitch_name: pitch.name,
      actor_id: req.user.id,
      actor_name: req.user.full_name,
      actor_role: req.user.role,
      action: 'CREATED',
      previous_status: null,
      new_status: 'pending',
      notes: `Requested ${bookingDate} (${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00)`,
    });

    res.status(201).json(formatBooking(created));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/bookings/:id/cancel', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, pitch:pitches(name)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only cancel your own booking requests.' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending booking requests can be cancelled by customers.' });
    }

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select(`
        *,
        pitch:pitches(id, code, name, location, status),
        customer:users!bookings_customer_id_fkey(id, full_name, email, phone, department)
      `)
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      booking_id: booking.id,
      pitch_name: booking.pitch?.name || 'Football Pitch',
      actor_id: req.user.id,
      actor_name: req.user.full_name,
      actor_role: 'customer',
      action: 'CANCELLED_BY_CUSTOMER',
      previous_status: 'pending',
      new_status: 'cancelled',
      notes: 'Cancelled by customer while pending review.',
    });

    res.json(formatBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/bookings/:id/decision', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { decision, adminNotes } = req.body;
    if (!['approved', 'rejected', 'cancelled'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid booking decision.' });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, pitch:pitches(name)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const prevStatus = booking.status;
    if ((decision === 'approved' || decision === 'rejected') && prevStatus !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be approved or rejected.' });
    }
    if (decision === 'cancelled' && prevStatus !== 'approved') {
      return res.status(400).json({ message: 'Only approved bookings can be cancelled by an administrator.' });
    }

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({
        status: decision,
        admin_notes: adminNotes || '',
        decided_by: req.user.id,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select(`
        *,
        pitch:pitches(id, code, name, location, status),
        customer:users!bookings_customer_id_fkey(id, full_name, email, phone, department)
      `)
      .single();

    if (error) {
      if (error.code === '23P01') {
        return res.status(409).json({
          message: 'Cannot approve: another active booking already overlaps this pitch and time range.',
        });
      }
      throw error;
    }

    const actionMap = {
      approved: 'APPROVED',
      rejected: 'REJECTED',
      cancelled: 'CANCELLED_BY_ADMIN',
    };

    await supabase.from('audit_logs').insert({
      booking_id: booking.id,
      pitch_name: booking.pitch?.name || 'Football Pitch',
      actor_id: req.user.id,
      actor_name: req.user.full_name,
      actor_role: 'admin',
      action: actionMap[decision],
      previous_status: prevStatus,
      new_status: decision,
      notes: adminNotes || `Marked as ${decision} by administrator.`,
    });

    res.json(formatBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 8. SPORTS FACILITIES DIRECTORY (INFORMATION-ONLY)
// ==========================================
app.get('/api/facilities', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    res.json(data.map(formatFacility));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/facilities', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      equipment,
      location,
      operatingHours,
      contactInfo,
      feeInfo,
      isActive,
      imageUrl,
      imagePublicId,
    } = req.body;

    if (!name || !category || !description || !location || !operatingHours) {
      return res.status(400).json({ message: 'Name, category, description, location, and operating hours are required.' });
    }

    const slug = `${name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { data: facility, error } = await supabase
      .from('facilities')
      .insert({
        name: name.trim(),
        slug,
        category,
        description,
        equipment: Array.isArray(equipment) ? equipment : [],
        location: location.trim(),
        operating_hours: operatingHours,
        contact_info: contactInfo || '',
        fee_info: feeInfo || '',
        is_active: isActive !== undefined ? Boolean(isActive) : true,
        image_url: imageUrl || '',
        image_public_id: imagePublicId || '',
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json(formatFacility(facility));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/facilities/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: existing } = await supabase.from('facilities').select('*').eq('id', req.params.id).maybeSingle();
    if (!existing) return res.status(404).json({ message: 'Facility not found.' });

    const {
      name,
      category,
      description,
      equipment,
      location,
      operatingHours,
      contactInfo,
      feeInfo,
      isActive,
      imageUrl,
      imagePublicId,
    } = req.body;

    if (imagePublicId && existing.image_public_id && imagePublicId !== existing.image_public_id) {
      await cloudinary.uploader.destroy(existing.image_public_id).catch(() => {});
    }

    const updates = { updated_at: new Date().toISOString() };
    if (name) updates.name = name.trim();
    if (category) updates.category = category;
    if (description) updates.description = description;
    if (Array.isArray(equipment)) updates.equipment = equipment;
    if (location) updates.location = location.trim();
    if (operatingHours) updates.operating_hours = operatingHours;
    if (contactInfo !== undefined) updates.contact_info = contactInfo;
    if (feeInfo !== undefined) updates.fee_info = feeInfo;
    if (isActive !== undefined) updates.is_active = Boolean(isActive);
    if (imageUrl !== undefined) updates.image_url = imageUrl;
    if (imagePublicId !== undefined) updates.image_public_id = imagePublicId;

    const { data: updated, error } = await supabase
      .from('facilities')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json(formatFacility(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/facilities/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: existing } = await supabase.from('facilities').select('*').eq('id', req.params.id).maybeSingle();
    if (!existing) return res.status(404).json({ message: 'Facility not found.' });

    if (existing.image_public_id) {
      await cloudinary.uploader.destroy(existing.image_public_id).catch(() => {});
    }

    const { error } = await supabase.from('facilities').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Facility removed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 9. ADMIN USER MANAGEMENT, STAFF ONBOARDING & AUDIT LOGS
// ==========================================
app.get('/api/admin/users', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data.map(formatUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/users/staff', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { fullName, email, password, phone, department, canManagePitches } = req.body;
    if (!fullName || !email) {
      return res.status(400).json({ message: 'Full name and institutional email are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const tempPassword = password && password.length >= 6 ? password : 'FrancoStaff2026!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const { data: staffUser, error } = await supabase
      .from('users')
      .insert({
        full_name: fullName.trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        phone: phone || '',
        department: department || 'Sports Operations',
        role: 'staff',
        account_status: 'active',
        can_manage_pitches: Boolean(canManagePitches),
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({
      user: formatUser(staffUser),
      temporaryPassword: tempPassword,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: target } = await supabase.from('users').select('*').eq('id', req.params.id).maybeSingle();
    if (!target) return res.status(404).json({ message: 'User not found.' });

    const { role, accountStatus, canManagePitches } = req.body;
    const updates = { updated_at: new Date().toISOString() };

    if (role && ['customer', 'staff', 'admin'].includes(role)) {
      updates.role = role;
      if (role === 'customer') updates.can_manage_pitches = false;
    }
    if (accountStatus && ['active', 'suspended'].includes(accountStatus)) {
      updates.account_status = accountStatus;
    }
    if (canManagePitches !== undefined && (updates.role || target.role) === 'staff') {
      updates.can_manage_pitches = Boolean(canManagePitches);
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ user: formatUser(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/audit-logs', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json(data.map(formatAuditLog));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 10. INITIAL DATABASE SEEDING (PITCHES A-H, SAMPLE DIRECTORY & ADMIN)
// ==========================================
async function seedInitialData() {
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'amaka.eze@francosports.sample').toLowerCase();
  const { data: adminExists } = await supabase
    .from('users')
    .select('id')
    .eq('email', adminEmail)
    .maybeSingle();

  if (!adminExists) {
    const passwordHash = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!', 12);
    const { error } = await supabase.from('users').insert({
      full_name: 'Dr. Amaka Eze [Sample Admin]',
      email: adminEmail,
      password_hash: passwordHash,
      phone: '+234 800 000 0001',
      department: 'Directorate of University Sports',
      role: 'admin',
      account_status: 'active',
      can_manage_pitches: true,
    });
    if (!error) console.log(`Seeded initial administrator: ${adminEmail}`);
  }

  const { count: pitchCount } = await supabase
    .from('pitches')
    .select('*', { count: 'exact', head: true });

  if (!pitchCount) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const initialPitches = letters.map((letter, idx) => ({
      code: `PITCH-${letter}`,
      name: `Pitch ${letter}`,
      slug: `pitch-${letter.toLowerCase()}`,
      location: `[Sample Location] North University Sports Complex — Sector ${idx + 1}`,
      surface_type: idx < 4 ? 'FIFA-Grade Synthetic Turf' : 'Natural Bermuda Grass',
      description: `[Sample Description] Regulation 11-a-side university football pitch (${letter}) with perimeter fencing and team dugouts.`,
      pricing_note: 'Free for registered students | Sample external rate applies',
      status: letter === 'D' ? 'maintenance' : 'active',
    }));
    const { error } = await supabase.from('pitches').insert(initialPitches);
    if (!error) console.log('Seeded Football Pitches A through H.');
  }

  const { count: facilityCount } = await supabase
    .from('facilities')
    .select('*', { count: 'exact', head: true });

  if (!facilityCount) {
    const { error } = await supabase.from('facilities').insert([
      {
        name: 'Main Indoor Basketball Arena [Sample]',
        slug: 'main-indoor-basketball-arena',
        category: 'basketball',
        description: '[Sample Data] Full-size hardwood basketball court with electronic scoreboard and spectator seating.',
        equipment: ['2 FIBA Hoops', 'Digital Shot Clocks', 'Bleacher Seating'],
        location: '[Sample Location] Indoor Sports Hall, Wing A',
        operating_hours: 'Mon–Sat: 07:00 – 21:00',
        contact_info: 'sports.desk@francosports.sample',
        fee_info: 'Free with valid university ID (Information-Only)',
        is_active: true,
      },
      {
        name: 'Student Union Table Tennis Hall [Sample]',
        slug: 'student-union-table-tennis-hall',
        category: 'table_tennis',
        description: '[Sample Data] Dedicated indoor hall equipped with six competition-grade table tennis tables.',
        equipment: ['6 ITTF Tables', 'Safety Barriers', 'LED Overhead Lighting'],
        location: '[Sample Location] Recreation Pavilion, Floor 1',
        operating_hours: 'Mon–Sun: 08:00 – 20:00',
        contact_info: 'recreation@francosports.sample',
        fee_info: 'Walk-in access during open hours',
        is_active: true,
      },
      {
        name: 'South Campus Lawn Tennis Courts [Sample]',
        slug: 'south-campus-lawn-tennis-courts',
        category: 'lawn_tennis',
        description: '[Sample Data] Four outdoor hard-surface tennis courts with windbreak netting.',
        equipment: ['4 Regulation Courts', 'Umpire Chairs', 'Practice Backboard'],
        location: '[Sample Location] South Athletic Zone',
        operating_hours: 'Mon–Sat: 06:30 – 19:00',
        contact_info: 'tennis.office@francosports.sample',
        fee_info: 'Student & faculty access (Information-Only)',
        is_active: true,
      },
      {
        name: 'University Aquatic Center [Sample]',
        slug: 'university-aquatic-center',
        category: 'swimming_pool',
        description: '[Sample Data] 8-lane 25-meter heated swimming pool supervised by certified lifeguards.',
        equipment: ['8 Starting Blocks', 'Lane Ropes', 'Locker & Shower Rooms'],
        location: '[Sample Location] West Campus Aquatic Complex',
        operating_hours: 'Tue–Sun: 07:00 – 18:00',
        contact_info: 'aquatics@francosports.sample',
        fee_info: 'Swim pass required at reception (Information-Only)',
        is_active: true,
      },
      {
        name: 'Varsity Fitness & Conditioning Gym [Sample]',
        slug: 'varsity-fitness-conditioning-gym',
        category: 'gym',
        description: '[Sample Data] Strength, cardio, and athletic conditioning center for university students and staff.',
        equipment: ['Free Weights & Squat Racks', 'Treadmills & Rowers', 'Stretching Mats'],
        location: '[Sample Location] Indoor Sports Hall, Ground Floor',
        operating_hours: 'Mon–Sat: 06:00 – 21:00',
        contact_info: 'fitness@francosports.sample',
        fee_info: 'Semester membership at sports desk (Information-Only)',
        is_active: true,
      },
    ]);
    if (!error) console.log('Seeded 5 sample multi-sport directory facilities.');
  }
}

// ==========================================
// 11. START SERVER
// ==========================================
seedInitialData()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Connected to Supabase`);
      console.log(`Franco Sports API server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Supabase startup error:', err.message);
    process.exit(1);
  });