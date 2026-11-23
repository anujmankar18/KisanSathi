
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Booking database structure
const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  date: { type: String, required: true },
  location: { type: String, required: true },
  service: { type: String, required: true },

  // Selected provider details
  provider: { type: String, default: '' },
  providerId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
  providerLocation: { type: String, default: '' },
  price: { type: Number, default: null },
  priceUnit: { type: String, default: '' },

  notes: { type: String, default: '' },
status: {
  type: String,
  enum: ['Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled'],
  default: 'Pending'
}
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

app.post('/api/bookings/lookup', async (req, res) => {
  try {
    const { bookingId, phone } = req.body || {};

    if (!bookingId || !phone) {
      return res.status(400).json({
        message: 'Booking ID and phone number are required.'
      });
    }

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(404).json({
        message: 'Booking not found. Check your details.'
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      phone: phone.trim()
    }).select('-phone -__v');

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found. Check your details.'
      });
    }

    res.json({
      message: 'Booking found.',
      booking
    });
  } catch (error) {
    console.error('Booking lookup error:', error.message);
    res.status(500).json({
      message: 'Could not look up booking.'
    });
  }
});

// ADD THE NEW CANCELLATION ROUTE HERE
app.post('/api/bookings/cancel', async (req, res) => {
  try {
    const { bookingId, phone } = req.body || {};

    if (!bookingId || !phone) {
      return res.status(400).json({
        message: 'Booking ID and phone number are required.',
      });
    }

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(404).json({
        message: 'Booking not found.',
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      phone: phone.trim(),
    });

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found. Check your details.',
      });
    }

    if (booking.status !== 'Pending') {
      return res.status(400).json({
        message: 'Only pending bookings can be cancelled.',
      });
    }

    booking.status = 'Cancelled';
    await booking.save();

    const safeBooking = booking.toObject();
    delete safeBooking.phone;
    delete safeBooking.__v;

    return res.json({
      message: 'Booking cancelled successfully.',
      booking: safeBooking,
    });
  } catch (error) {
    console.error('Booking cancellation error:', error.message);

    return res.status(500).json({
      message: 'Could not cancel booking.',
    });
  }
});


// Verify farmer or provider JWT
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Please log in first.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id || !['farmer', 'provider'].includes(decoded.role)) {
      return res.status(403).json({
        message: 'Access denied.'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired login. Please log in again.'
    });
  }
}

// Verify admin JWT
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Admin login required.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        message: 'Admin access required.'
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired login. Please log in again.'
    });
  }
}

/* Register a new farmer or service provider */
app.post('/api/auth/register', async (req, res) => {
  try {
const {
  name,
  email,
  phone,
  password,
  role,
  serviceName,
  providerLocation,
  price,
  priceUnit
} = req.body || {};

    // Check required fields
    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({
        message: 'Please fill in all required fields.'
      });
    }

    // Public registration is only for farmers and providers
    if (!['farmer', 'provider'].includes(role)) {
      return res.status(400).json({
        message: 'Invalid role. Register as a farmer or provider.'
      });
    }

    // Basic input validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        message: 'Please enter a valid email address.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must contain at least 8 characters.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if the email is already registered
    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'This email is already registered.'
      });
    }

    // Hash the password before saving it
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the account
const user = await User.create({
  name: name.trim(),
  email: normalizedEmail,
  phone: phone.trim(),
  password: hashedPassword,
  role: role,

  // Provider information
  serviceName: role === 'provider' ? serviceName?.trim() || '' : '',
  providerLocation: role === 'provider' ? providerLocation?.trim() || '' : '',
  price: role === 'provider' && price !== undefined && price !== ''
    ? Number(price)
    : null,
  priceUnit: role === 'provider' ? priceUnit?.trim() || '' : '',

  isApproved: role === 'farmer',
  isActive: true
});

    return res.status(201).json({
      message: role === 'provider'
        ? 'Registration successful! Please wait for admin approval.'
        : 'Farmer registration successful!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      }
    });

  } catch (error) {
    console.error('Registration error:', error.message);

    // Handle duplicate email if two requests arrive together
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This email is already registered.'
      });
    }

    return res.status(500).json({
      message: 'Could not complete registration.'
    });
  }
});

/* Login for farmers and service providers */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is inactive.'
      });
    }

    if (user.role === 'provider' && !user.isApproved) {
      return res.status(403).json({
        message: 'Your account is awaiting admin approval.'
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);

    return res.status(500).json({
      message: 'Login failed. Please try again.'
    });
  }
});

// Home route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to KisanSathi API!',
    status: 'Backend is running'
  });
});

// Services
app.get('/api/services', (req, res) => {
  res.json([
    { id: 1, name: 'Tractor Rental' },
    { id: 2, name: 'Harvester Rental' },
    { id: 3, name: 'Farm Mechanics' },
    { id: 4, name: 'Farm Labour' },
    { id: 5, name: 'Transport Services' },
    { id: 6, name: 'Soil Testing' }
  ]);
});

// Fetch approved and active service providers
app.get('/api/providers', async (req, res) => {
  try {
    const { serviceName } = req.query;

    // Only show approved and active providers
    const filter = {
      role: 'provider',
      isApproved: true,
      isActive: true
    };

    // Filter providers by service name if requested
    if (serviceName) {
      filter.serviceName = serviceName.trim();
    }

    const providers = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(providers);

  } catch (error) {
    console.error('Fetch providers error:', error.message);

    res.status(500).json({
      message: 'Could not fetch providers.'
    });
  }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        message: 'Username and password are required.'
      });
    }

    if (
      !process.env.ADMIN_USERNAME ||
      !process.env.ADMIN_PASSWORD_HASH ||
      !process.env.JWT_SECRET
    ) {
      return res.status(500).json({
        message: 'Admin login is not configured on the server.'
      });
    }

    const usernameMatches = username === process.env.ADMIN_USERNAME;
    const passwordMatches = await bcrypt.compare(
      password,
      process.env.ADMIN_PASSWORD_HASH
    );

    if (!usernameMatches || !passwordMatches) {
      return res.status(401).json({
        message: 'Invalid username or password.'
      });
    }

    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Admin login successful!',
      token
    });
  } catch (error) {
    console.error('Admin login error:', error.message);
    res.status(500).json({
      message: 'Could not complete admin login.'
    });
  }
});

// Create booking
// Create booking

// Create booking
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      name, phone, date, location, service,
      provider, providerId, providerLocation,
      price, priceUnit, notes
    } = req.body || {};

    if (!name || !phone || !date || !location || !service) {
      return res.status(400).json({
        message: 'Please provide all required details.'
      });
    }

    const parsedPrice =
      price === undefined || price === null || price === ''
        ? null
        : Number(price);

    if (
      parsedPrice !== null &&
      (!Number.isFinite(parsedPrice) || parsedPrice < 0)
    ) {
      return res.status(400).json({
        message: 'Please provide a valid provider price.'
      });
    }

    let selectedProviderId = null;

    if (providerId) {
      if (!mongoose.isValidObjectId(providerId)) {
        return res.status(400).json({
          message: 'Invalid provider ID.'
        });
      }

const selectedProvider = await User.findOne({
  _id: providerId,
  role: 'provider',
  isApproved: true,
  isActive: true,
  serviceName: service.trim()
});

      if (!selectedProvider) {
        return res.status(404).json({
          message: 'Approved service provider not found.'
        });
      }

      selectedProviderId = selectedProvider._id;
    }

    const booking = await Booking.create({
      name: name.trim(),
      phone: phone.trim(),
      date,
      location: location.trim(),
      service,
      provider: provider || '',
      providerId: selectedProviderId,
      providerLocation: providerLocation || '',
      price: parsedPrice,
      priceUnit: priceUnit || '',
      notes: notes || ''
    });

    res.status(201).json({
      message: 'Booking submitted successfully!',
      booking
    });
  } catch (error) {
    console.error('Booking error:', error.message);

    res.status(500).json({
      message: 'Could not save booking.'
    });
  }
});


// Existing bookings route (used by the current frontend)

// Provider: View own booking requests
app.get(
  '/api/provider/bookings',
  authenticateUser,
  async (req, res) => {
    try {
      if (req.user.role !== 'provider') {
        return res.status(403).json({
          message: 'Provider access required.'
        });
      }

      const bookings = await Booking.find({
        providerId: req.user.id
      }).sort({ createdAt: -1 });

      res.json(bookings);
    } catch (error) {
      console.error('Provider bookings error:', error.message);

      res.status(500).json({
        message: 'Could not fetch provider bookings.'
      });
    }
  }
);

// Provider: Accept or reject their own booking requests
app.patch(
  '/api/provider/bookings/:id/status',
  authenticateUser,
  async (req, res) => {
    try {
      if (req.user.role !== 'provider') {
        return res.status(403).json({
          message: 'Only service providers can update booking requests.'
        });
      }

      const { status } = req.body || {};

      if (!['Accepted', 'Rejected'].includes(status)) {
        return res.status(400).json({
          message: 'Status must be Accepted or Rejected.'
        });
      }

      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid booking ID.'
        });
      }

      // Only update a Pending booking assigned to this provider
      const booking = await Booking.findOneAndUpdate(
        {
          _id: req.params.id,
          providerId: req.user.id,
          status: 'Pending'
        },
        { status },
        {
          new: true,
          runValidators: true
        }
      );

      if (!booking) {
        return res.status(404).json({
          message: 'Pending booking not found for your account.'
        });
      }

      return res.json({
        message: `Booking ${status.toLowerCase()} successfully!`,
        booking
      });

    } catch (error) {
      console.error('Provider booking status error:', error.message);

      return res.status(500).json({
        message: 'Could not update booking status.'
      });
    }
  }
);


// Admin: View all service providers
app.get('/api/admin/providers', authenticateAdmin, async (req, res) => {
  try {
    const providers = await User.find({ role: 'provider' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(providers);
  } catch (error) {
    console.error('Fetch providers error:', error.message);
    res.status(500).json({
      message: 'Could not fetch providers.'
    });
  }
});

// Admin: Approve or reject a service provider
app.patch(
  '/api/admin/providers/:id/approval',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { isApproved } = req.body;

      if (typeof isApproved !== 'boolean') {
        return res.status(400).json({
          message: 'isApproved must be true or false.'
        });
      }

      const provider = await User.findOneAndUpdate(
        {
          _id: req.params.id,
          role: 'provider'
        },
        { isApproved },
        { new: true, runValidators: true }
      ).select('-password');

      if (!provider) {
        return res.status(404).json({
          message: 'Service provider not found.'
        });
      }

      res.json({
        message: isApproved
          ? 'Service provider approved successfully!'
          : 'Service provider approval revoked.',
        provider
      });
    } catch (error) {
      console.error('Provider approval error:', error.message);

      if (error.name === 'CastError') {
        return res.status(400).json({
          message: 'Invalid provider ID.'
        });
      }

      res.status(500).json({
        message: 'Could not update provider approval.'
      });
    }
  }
);
// Protected admin bookings route
app.get('/api/admin/bookings', authenticateAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error('Admin fetch error:', error.message);
    res.status(500).json({
      message: 'Could not fetch admin bookings.'
    });
  }
});

// Update booking status — admin only
app.patch(
  '/api/bookings/:id/status',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;
const allowedStatuses = [
  'Pending',
  'Accepted',
  'Rejected',
  'Completed',
  'Cancelled'
];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: 'Invalid booking status.'
        });
      }

      const booking = await Booking.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
      );

      if (!booking) {
        return res.status(404).json({
          message: 'Booking not found.'
        });
      }

      res.json({
        message: 'Booking status updated successfully!',
        booking
      });
    } catch (error) {
      console.error('Status update error:', error.message);

      if (error.name === 'CastError') {
        return res.status(400).json({
          message: 'Invalid booking ID.'
        });
      }

      res.status(500).json({
        message: 'Could not update booking status.'
      });
    }
  }
);
// Handle unknown API routes with JSON instead of HTML
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Handle unexpected server errors with JSON
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error.',
  });
});
// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully!');
    app.listen(PORT, () => {
      console.log(`KisanSathi API running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
  });
