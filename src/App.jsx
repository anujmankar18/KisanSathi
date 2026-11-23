import { useEffect, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000/api';

const services = [
  {
    id: 1,
    icon: '🚜',
    name: 'Tractor Rental',
    category: 'Machinery',
    description: 'Find tractors for ploughing and farming.',
  },
  {
    id: 2,
    icon: '🌾',
    name: 'Harvester Rental',
    category: 'Machinery',
    description: 'Make harvesting easier and faster.',
  },
  {
    id: 3,
    icon: '🔧',
    name: 'Farm Mechanics',
    category: 'Repair',
    description: 'Find help for agricultural machinery.',
  },
  {
    id: 4,
    icon: '👨‍🌾',
    name: 'Farm Labour',
    category: 'Labour',
    description: 'Connect with available farm workers.',
  },
  {
    id: 5,
    icon: '🚚',
    name: 'Transport Services',
    category: 'Transport',
    description: 'Arrange transport for your crops.',
  },
  {
    id: 6,
    icon: '🧪',
    name: 'Soil Testing',
    category: 'Other',
    description: 'Find soil testing services for your farm.',
  },
];

const categories = [
  'All',
  'Machinery',
  'Repair',
  'Labour',
  'Transport',
  'Other',
];

const bookingStatuses = [
  'Pending',
  'Accepted',
  'Rejected',
  'Completed',
  'Cancelled'
];

function App() {
  // ---------------- AUTHENTICATION ----------------

  const [authPage, setAuthPage] = useState('login');
  const [showAccount, setShowAccount] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kisansathiUser')) || null;
    } catch {
      return null;
    }
  });

  const [authLoading, setAuthLoading] = useState(false);

  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'farmer',
    serviceName: 'Tractor Rental',
    providerLocation: '',
    price: '',
    priceUnit: 'day',
  });

  const [message, setMessage] = useState('');

  // ---------------- SERVICE SEARCH ----------------

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [expandedServiceId, setExpandedServiceId] = useState(null);

  // Actual providers fetched from MongoDB
  const [providers, setProviders] = useState({});
  const [providerLoading, setProviderLoading] = useState(false);

  // ---------------- BOOKING ----------------

  const [selectedService, setSelectedService] = useState(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    date: '',
    location: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);

  const [bookingId, setBookingId] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // ---------------- ADMIN ----------------

  const [adminToken, setAdminToken] = useState('');
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });

  const [adminBookings, setAdminBookings] = useState([]);
  const [adminProviders, setAdminProviders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // ---------------- PROVIDER DASHBOARD ----------------

  const [providerBookings, setProviderBookings] = useState([]);

  const providerStats = {
  total: providerBookings.length,

  pending: providerBookings.filter(
    (booking) => booking.status === 'Pending'
  ).length,

  accepted: providerBookings.filter(
    (booking) => booking.status === 'Accepted'
  ).length,

  rejected: providerBookings.filter(
    (booking) => booking.status === 'Rejected'
  ).length,
};

  // ---------------- AUTH HANDLER ----------------

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setMessage('');
    setAuthLoading(true);

    try {
      const endpoint =
        authPage === 'register' ? '/auth/register' : '/auth/login';

      const registrationData = {
        name: authForm.name,
        email: authForm.email,
        phone: authForm.phone,
        password: authForm.password,
        role: authForm.role,
        serviceName: authForm.serviceName,
        providerLocation: authForm.providerLocation,
        price: authForm.price,
        priceUnit: authForm.priceUnit,
      };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          authPage === 'register'
            ? registrationData
            : {
                email: authForm.email,
                password: authForm.password,
              }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }

      if (authPage === 'register') {
        setMessage(data.message);
        setAuthPage('login');

        setAuthForm((previous) => ({
          ...previous,
          name: '',
          phone: '',
          password: '',
        }));
      } else {
        setUser(data.user);

        localStorage.setItem('kisansathiToken', data.token);
        localStorage.setItem(
          'kisansathiUser',
          JSON.stringify(data.user)
        );

        setMessage(`Welcome, ${data.user.name}!`);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleUserLogout() {
    setUser(null);
    localStorage.removeItem('kisansathiToken');
    localStorage.removeItem('kisansathiUser');

    setProviderBookings([]);
    setAuthPage('login');
    setMessage('You have logged out successfully.');
  }

  // ---------------- FETCH PROVIDERS ----------------

  async function fetchProviders(serviceName) {
    setProviderLoading(true);

    try {
      const url = `${API_URL}/providers?serviceName=${encodeURIComponent(
        serviceName
      )}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not fetch providers.');
      }

      setProviders((previous) => ({
        ...previous,
        [serviceName]: data,
      }));
    } catch (error) {
      console.error('Provider fetch error:', error);
      setMessage(error.message);
    } finally {
      setProviderLoading(false);
    }
  }

  function showServiceProviders(service) {
    const isAlreadyOpen = expandedServiceId === service.id;

    if (isAlreadyOpen) {
      setExpandedServiceId(null);
      return;
    }

    setExpandedServiceId(service.id);

    // Fetch providers from MongoDB
    if (!providers[service.name]) {
      fetchProviders(service.name);
    }
  }

  // ---------------- FILTER SERVICES ----------------

  const filteredServices = services.filter((service) => {
    const text = search.toLowerCase();

    const matchesSearch =
      service.name.toLowerCase().includes(text) ||
      service.description.toLowerCase().includes(text) ||
      service.category.toLowerCase().includes(text);

    return (
      matchesSearch &&
      (category === 'All' || service.category === category)
    );
  });

  // ---------------- BOOKING FORM ----------------

  function openBooking(service, provider) {
    setSelectedService({
      ...service,
      selectedProvider: provider,
    });

    setExpandedServiceId(null);

    setForm({
      name: user?.name || '',
      phone: user?.phone || '',
      date: '',
      location: '',
      notes: '',
    });

    setMessage('');

    setTimeout(() => {
      document.getElementById('booking-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!selectedService) {
      setMessage('Please select a service first.');
      return;
    }

    if (!selectedService.selectedProvider?._id) {
      setMessage('Please select a valid provider.');
      return;
    }

    setLoading(true);

    try {
      const selectedProvider = selectedService.selectedProvider;

      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          service: selectedService.name,

          provider: selectedProvider.name,
          providerId: selectedProvider._id,
          providerLocation: selectedProvider.providerLocation,
          price: selectedProvider.price,
          priceUnit: selectedProvider.priceUnit,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Booking failed.');
      }

      const newBooking = data.booking;

      setLookupResult(newBooking);
      setBookingId(newBooking._id);
      setLookupPhone(form.phone);

      setMessage(
        `Booking submitted successfully! Save your Booking ID: ${newBooking._id}`
      );

      setSelectedService(null);

      setForm({
        name: '',
        phone: '',
        date: '',
        location: '',
        notes: '',
      });

      document.getElementById('bookings')?.scrollIntoView({
        behavior: 'smooth',
      });
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- BOOKING LOOKUP ----------------

  async function handleBookingLookup(event) {
    event.preventDefault();

    setMessage('');
    setLookupResult(null);
    setLookupLoading(true);

    try {
      const response = await fetch(`${API_URL}/bookings/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: bookingId.trim(),
          phone: lookupPhone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Booking not found.');
      }

      setLookupResult(data.booking);
      setMessage('Booking found successfully.');
    } catch (error) {
      setMessage(error.message || 'Could not find your booking.');
    } finally {
      setLookupLoading(false);
    }
  }

  // ---------------- CANCEL BOOKING ----------------

  async function handleCancelBooking() {
    if (!lookupResult?._id || !lookupPhone.trim()) {
      setMessage('Please find your booking first.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to cancel this booking?'
    );

    if (!confirmed) return;

    setMessage('');
    setLookupLoading(true);

    try {
      const response = await fetch(`${API_URL}/bookings/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: lookupResult._id,
          phone: lookupPhone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Cancellation failed.');
      }

      setLookupResult(data.booking);
      setMessage(data.message || 'Booking cancelled successfully.');
    } catch (error) {
      setMessage(`Cancellation error: ${error.message}`);
    } finally {
      setLookupLoading(false);
    }
  }

  // ---------------- ADMIN LOGIN ----------------

  async function handleAdminLogin(event) {
    event.preventDefault();

    setLoginLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      setAdminToken(data.token);
      setAdminLoggedIn(true);

      setCredentials({
        username: '',
        password: '',
      });

      setMessage('Admin login successful!');

      await fetchAdminBookings(data.token);
      await fetchAdminProviders(data.token);
    } catch (error) {
      setMessage(`Login error: ${error.message}`);
    } finally {
      setLoginLoading(false);
    }
  }

  // ---------------- FETCH ADMIN BOOKINGS ----------------

  async function fetchAdminBookings(token, showMessage = false) {
    setRefreshing(true);

    try {
      const response = await fetch(`${API_URL}/admin/bookings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          throw new Error('Your admin session expired. Please log in again.');
        }

        throw new Error(data.message || 'Unable to load admin bookings.');
      }

      setAdminBookings(data);

      if (showMessage) {
        setMessage('Admin bookings refreshed successfully.');
      }
    } catch (error) {
      console.error('Admin bookings error:', error);
      setMessage(error.message || 'Could not load admin bookings.');
    } finally {
      setRefreshing(false);
    }
  }

  // ---------------- FETCH ADMIN PROVIDERS ----------------

  async function fetchAdminProviders(token) {
    try {
      const response = await fetch(`${API_URL}/admin/providers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load providers.');
      }

      setAdminProviders(data);
    } catch (error) {
      console.error('Admin providers error:', error);
      setMessage(error.message || 'Could not load providers.');
    }
  }

  // ---------------- APPROVE / REJECT PROVIDER ----------------

  async function updateProviderApproval(id, isApproved) {
    if (!adminToken) {
      setMessage('Please log in as admin first.');
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/admin/providers/${id}/approval`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            isApproved,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Provider approval failed.');
      }

      setAdminProviders((previous) =>
        previous.map((provider) =>
          provider._id === id ? data.provider : provider
        )
      );

      setMessage(data.message);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  }

  // ---------------- ADMIN BOOKING STATUS ----------------

  async function updateBookingStatus(id, status) {
    if (!adminToken) {
      setMessage('Please log in as admin first.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/bookings/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Status update failed.');
      }

      setAdminBookings((previous) =>
        previous.map((booking) =>
          booking._id === id ? data.booking : booking
        )
      );

      setLookupResult((previous) =>
        previous && previous._id === id ? data.booking : previous
      );

      setMessage(`Booking status updated to ${status}.`);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  }

  // ---------------- ADMIN LOGOUT ----------------

  function handleLogout() {
    setAdminToken('');
    setAdminLoggedIn(false);
    setAdminBookings([]);
    setAdminProviders([]);

    setMessage('You have logged out of the Admin Panel.');
  }

  // ---------------- PROVIDER BOOKINGS ----------------

  async function fetchProviderBookings() {
    const token = localStorage.getItem('kisansathiToken');

    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/provider/bookings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not fetch provider bookings.');
      }

      setProviderBookings(data);
    } catch (error) {
      console.error('Provider bookings error:', error);
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (user?.role === 'provider' && user.isApproved) {
      fetchProviderBookings();
    }
  }, [user]);

  // Provider: Accept or reject a booking
async function updateProviderBookingStatus(bookingId, status) {
  const token = localStorage.getItem('kisansathiToken');

  if (!token) {
    setMessage('Please log in again.');
    return;
  }

  const action = status === 'Accepted' ? 'accept' : 'reject';

  const confirmed = window.confirm(
    `Are you sure you want to ${action} this booking?`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_URL}/provider/bookings/${bookingId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Could not update booking.');
    }

    // Update the selected booking in the dashboard
    setProviderBookings((previous) =>
      previous.map((booking) =>
        booking._id === bookingId ? data.booking : booking
      )
    );

    setMessage(data.message || `Booking ${status.toLowerCase()}.`);

    // Refresh the latest booking information
    await fetchProviderBookings();

  } catch (error) {
    setMessage(error.message);
  }
}

  // ---------------- UI ----------------

  return (
    <div className="app">

      {/* NAVBAR */}

      <header className="navbar">
        <a className="brand" href="#home">
          🌱 KisanSathi
        </a>

        <nav>
          <a href="#home">Home</a>
          <a href="#services">Services</a>
          <a href="#bookings">Track Booking</a>
          <a href="#admin">Admin Panel</a>
          <a href="#about">About</a>
        </nav>

        <button
          type="button"
          className="login-btn"
          onClick={() => {
            setShowAccount(true);
            setMessage('');
            window.location.hash = 'account';
          }}
        >
          {user ? user.name : 'Login / Register'}
        </button>
      </header>

      <main>

        {/* ACCOUNT SECTION - HIDDEN UNTIL LOGIN / REGISTER IS CLICKED */}

        {showAccount && (
        <section className="booking-section" id="account">
          <div className="booking-card">
            <button
              type="button"
              className="close-btn"
              onClick={() => {
                setShowAccount(false);
                setMessage('');
                window.location.hash = 'home';
              }}
            >
              ✕ Close
            </button>

            <h2>
              {user
                ? 'My Account'
                : authPage === 'register'
                ? 'Create Account'
                : 'Login'}
            </h2>

            {!user && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthPage('login');
                    setMessage('');
                  }}
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthPage('register');
                    setMessage('');
                  }}
                >
                  Register
                </button>
              </div>
            )}

            {user ? (
              <div>
                <h3>Welcome, {user.name}!</h3>

                <p>
                  Account Type: <strong>{user.role.toUpperCase()}</strong>
                </p>

                {user.role === 'farmer' && (
                  <div>
                    <h3>🌾 Farmer Dashboard</h3>
                    <p>Browse agricultural services and manage your bookings.</p>

                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('services')?.scrollIntoView({
                          behavior: 'smooth',
                        });
                      }}
                    >
                      Browse Services
                    </button>
                  </div>
                )}

{user.role === 'provider' && (
  <div className="provider-dashboard">

    <div className="provider-dashboard-header">
      <div>
        <span className="tag">SERVICE PROVIDER</span>
        <h2>🚜 Provider Dashboard</h2>
        <p>Manage your agricultural service bookings.</p>
      </div>

      <span
        className={
          user.isApproved
            ? 'provider-account-approved'
            : 'provider-account-pending'
        }
      >
        {user.isApproved ? '✓ Approved' : '⏳ Pending Approval'}
      </span>
    </div>

    {!user.isApproved ? (
      <div className="provider-waiting">
        <h3>Account Under Review</h3>
        <p>
          Your registration is waiting for admin approval.
          You will be able to manage bookings after approval.
        </p>
      </div>
    ) : (
      <>
        <div className="provider-stats">

          <div className="provider-stat-card">
            <span>📋</span>
            <p>Total Bookings</p>
            <h2>{providerStats.total}</h2>
          </div>

          <div className="provider-stat-card pending-stat">
            <span>⏳</span>
            <p>Pending</p>
            <h2>{providerStats.pending}</h2>
          </div>

          <div className="provider-stat-card accepted-stat">
            <span>✓</span>
            <p>Accepted</p>
            <h2>{providerStats.accepted}</h2>
          </div>

          <div className="provider-stat-card rejected-stat">
            <span>✕</span>
            <p>Rejected</p>
            <h2>{providerStats.rejected}</h2>
          </div>

        </div>

        <div className="provider-bookings-heading">
          <div>
            <h3>My Booking Requests</h3>
            <p>Review and respond to farmers' requests.</p>
          </div>

          <button
            type="button"
            onClick={fetchProviderBookings}
          >
            ↻ Refresh Bookings
          </button>
        </div>

        {providerBookings.length === 0 ? (
          <div className="provider-empty">
            <span>📭</span>
            <h3>No Booking Requests Yet</h3>
            <p>
              New farmer booking requests will appear here.
            </p>
          </div>
        ) : (
          <div className="provider-booking-grid">

            {providerBookings.map((booking) => (
              <article
                className="provider-booking-card"
                key={booking._id}
              >
                <div className="provider-booking-top">
                  <h3>{booking.service}</h3>

                  <span
                    className={`booking-status status-${(
                      booking.status || 'Pending'
                    ).toLowerCase()}`}
                  >
                    {booking.status || 'Pending'}
                  </span>
                </div>

                <div className="provider-booking-details">
                  <p>
                    <strong>👨‍🌾 Farmer:</strong> {booking.name}
                  </p>

                  <p>
                    <strong>📞 Phone:</strong> {booking.phone}
                  </p>

                  <p>
                    <strong>📅 Required Date:</strong> {booking.date}
                  </p>

                  <p>
                    <strong>📍 Farm Location:</strong> {booking.location}
                  </p>

                  {booking.price != null && (
                    <p>
                      <strong>💰 Price:</strong> ₹{booking.price}/
                      {booking.priceUnit || 'unit'}
                    </p>
                  )}

                  {booking.notes && (
                    <p>
                      <strong>📝 Requirements:</strong> {booking.notes}
                    </p>
                  )}

                  <p className="provider-booking-id">
                    Booking ID: {booking._id}
                  </p>
                </div>

                {booking.status === 'Pending' && (
                  <div className="provider-booking-actions">

                    <button
                      type="button"
                      className="accept-booking-btn"
                      onClick={() =>
                        updateProviderBookingStatus(
                          booking._id,
                          'Accepted'
                        )
                      }
                    >
                      ✓ Accept Booking
                    </button>

                    <button
                      type="button"
                      className="reject-booking-btn"
                      onClick={() =>
                        updateProviderBookingStatus(
                          booking._id,
                          'Rejected'
                        )
                      }
                    >
                      ✕ Reject Booking
                    </button>

                  </div>
                )}
              </article>
            ))}

          </div>
        )}
      </>
    )}
  </div>
)}

                <button
                  type="button"
                  onClick={handleUserLogout}
                  style={{ marginTop: '20px' }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit}>

                {authPage === 'register' && (
                  <>
                    <label>Full Name</label>
                    <input
                      required
                      value={authForm.name}
                      onChange={(e) =>
                        setAuthForm({
                          ...authForm,
                          name: e.target.value,
                        })
                      }
                      placeholder="Enter your full name"
                    />

                    <label>Mobile Number</label>
                    <input
                      required
                      type="tel"
                      pattern="[6-9][0-9]{9}"
                      value={authForm.phone}
                      onChange={(e) =>
                        setAuthForm({
                          ...authForm,
                          phone: e.target.value,
                        })
                      }
                      placeholder="Enter your 10-digit mobile number"
                    />

                    <label>Account Type</label>
                    <select
                      value={authForm.role}
                      onChange={(e) =>
                        setAuthForm({
                          ...authForm,
                          role: e.target.value,
                        })
                      }
                    >
                      <option value="farmer">Farmer</option>
                      <option value="provider">Service Provider</option>
                    </select>

                    {/* PROVIDER FIELDS */}

                    {authForm.role === 'provider' && (
                      <>
                        <h3 style={{ marginTop: '20px' }}>
                          Provider Details
                        </h3>

                        <label>Service Offered</label>
                        <select
                          required
                          value={authForm.serviceName}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              serviceName: e.target.value,
                            })
                          }
                        >
                          {services.map((service) => (
                            <option
                              key={service.id}
                              value={service.name}
                            >
                              {service.name}
                            </option>
                          ))}
                        </select>

                        <label>Service Location</label>
                        <input
                          required
                          value={authForm.providerLocation}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              providerLocation: e.target.value,
                            })
                          }
                          placeholder="Example: Pune"
                        />

                        <label>Service Price (₹)</label>
                        <input
                          required
                          type="number"
                          min="0"
                          value={authForm.price}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              price: e.target.value,
                            })
                          }
                          placeholder="Example: 800"
                        />

                        <label>Price Unit</label>
                        <select
                          required
                          value={authForm.priceUnit}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              priceUnit: e.target.value,
                            })
                          }
                        >
                          <option value="day">Per Day</option>
                          <option value="hour">Per Hour</option>
                          <option value="visit">Per Visit</option>
                          <option value="trip">Per Trip</option>
                          <option value="test">Per Test</option>
                          <option value="person">Per Person</option>
                        </select>
                      </>
                    )}
                  </>
                )}

                <label>Email Address</label>
                <input
                  required
                  type="email"
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({
                      ...authForm,
                      email: e.target.value,
                    })
                  }
                  placeholder="Enter your email"
                />

                <label>Password</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm({
                      ...authForm,
                      password: e.target.value,
                    })
                  }
                  placeholder="Minimum 8 characters"
                />

                <button type="submit" disabled={authLoading}>
                  {authLoading
                    ? 'Please wait...'
                    : authPage === 'register'
                    ? 'Create Account'
                    : 'Login'}
                </button>
              </form>
            )}
          </div>
        </section>
        )}

        {/* HERO */}

        <section className="hero" id="home">
          <div className="hero-content">
            <span className="tag">YOUR FARM, OUR SUPPORT</span>

            <h1>
              Smart Farming Starts with <span>KisanSathi</span>
            </h1>

            <p>
              Find agricultural machinery, skilled workers and farming
              services in one convenient place.
            </p>

            <a className="primary-btn" href="#services">
              Explore Services →
            </a>
          </div>

          <div className="hero-icon">🌾🚜🌱</div>
        </section>

        {/* SERVICES */}

        <section className="services-section" id="services">
          <div className="section-heading">
            <span>WHAT WE OFFER</span>
            <h2>Agricultural Services</h2>
            <p>Everything your farm needs, all in one place.</p>
          </div>

          <div className="service-tools">
            <input
              type="search"
              placeholder="Search tractors, labour, transport..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="category-filters">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={
                    category === item ? 'filter-btn active' : 'filter-btn'
                  }
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="service-grid">
            {filteredServices.map((service) => {
              const serviceProviders = providers[service.name] || [];

              return (
                <article className="service-card" key={service.id}>
                  <div className="service-icon">{service.icon}</div>

                  <h3>{service.name}</h3>

                  <p>{service.description}</p>

                  <button
                    type="button"
                    onClick={() => showServiceProviders(service)}
                  >
                    {expandedServiceId === service.id
                      ? 'Hide Providers ↑'
                      : 'Compare Providers →'}
                  </button>

                  {expandedServiceId === service.id && (
                    <div
                      className="provider-list"
                      id={`providers-${service.id}`}
                    >
                      <h4>Compare Providers & Prices</h4>

                      {providerLoading && !providers[service.name] && (
                        <p>Loading providers...</p>
                      )}

                      {!providerLoading &&
                        providers[service.name] &&
                        serviceProviders.length === 0 && (
                          <p>
                            No approved providers available for this service
                            yet.
                          </p>
                        )}

                      {serviceProviders.map((provider) => (
                        <div
                          className="provider-option"
                          key={provider._id}
                        >
                          <p>
                            <strong>Provider:</strong> {provider.name}
                          </p>

                          <p>
                            <strong>Location:</strong> 📍{' '}
                            {provider.providerLocation}
                          </p>

                          <p>
                            <strong>Price:</strong> ₹{provider.price}/
                            {provider.priceUnit}
                          </p>

                          {user?.role === 'farmer' ? (
                            <button
                              type="button"
                              onClick={() => openBooking(service, provider)}
                            >
                              Book This Provider →
                            </button>
                          ) : (
                            <p>
                              Please log in as a Farmer to book this provider.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {filteredServices.length === 0 && (
            <p className="empty-message">
              No services found. Try another search or category.
            </p>
          )}
        </section>

        {/* GLOBAL MESSAGE */}

        {message && (
          <div className="success-message" role="status">
            {message}
          </div>
        )}

        {/* BOOKING FORM */}

        {selectedService && (
          <section className="booking-section" id="booking-form">
            <div className="booking-card">
              <button
                className="close-btn"
                type="button"
                onClick={() => setSelectedService(null)}
              >
                ✕ Close
              </button>

              <span className="tag">KISANSATHI BOOKING</span>

              <h2>Book {selectedService.name}</h2>

              <p>{selectedService.description}</p>

              <div className="selected-provider">
                <h3>Selected Provider</h3>

                <p>
                  <strong>Name:</strong>{' '}
                  {selectedService.selectedProvider.name}
                </p>

                <p>
                  <strong>Location:</strong>{' '}
                  {selectedService.selectedProvider.providerLocation}
                </p>

                <p>
                  <strong>Price:</strong> ₹
                  {selectedService.selectedProvider.price}/
                  {selectedService.selectedProvider.priceUnit}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <label htmlFor="farmer-name">Farmer name *</label>

                <input
                  id="farmer-name"
                  name="name"
                  required
                  maxLength={80}
                  value={form.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                />

                <label htmlFor="farmer-phone">Mobile number *</label>

                <input
                  id="farmer-phone"
                  name="phone"
                  type="tel"
                  required
                  pattern="[6-9][0-9]{9}"
                  title="Enter a valid 10-digit Indian mobile number"
                  value={form.phone}
                  onChange={handleInputChange}
                  placeholder="10-digit mobile number"
                />

                <label htmlFor="booking-date">Required date *</label>

                <input
                  id="booking-date"
                  name="date"
                  type="date"
                  required
                  min={new Date().toLocaleDateString('en-CA')}
                  value={form.date}
                  onChange={handleInputChange}
                />

                <label htmlFor="farm-location">
                  Village / location *
                </label>

                <input
                  id="farm-location"
                  name="location"
                  required
                  maxLength={150}
                  value={form.location}
                  onChange={handleInputChange}
                  placeholder="Enter village or area"
                />

                <label htmlFor="booking-notes">
                  Additional details
                </label>

                <textarea
                  id="booking-notes"
                  name="notes"
                  maxLength={500}
                  rows={3}
                  value={form.notes}
                  onChange={handleInputChange}
                  placeholder="Describe your farming requirements"
                />

                <button
                  className="submit-btn"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Booking Request'}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* TRACK BOOKING */}

        <section className="bookings-section" id="bookings">
          <div className="section-heading">
            <span>YOUR ACTIVITY</span>
            <h2>Track My Booking</h2>

            <p>
              Enter your Booking ID and registered mobile number to check
              your booking status.
            </p>
          </div>

          <div className="booking-card">
            <form onSubmit={handleBookingLookup}>
              <label htmlFor="lookup-id">Booking ID *</label>

              <input
                id="lookup-id"
                value={bookingId}
                onChange={(event) => setBookingId(event.target.value)}
                required
                placeholder="Paste your booking ID"
              />

              <label htmlFor="lookup-phone">
                Registered mobile number *
              </label>

              <input
                id="lookup-phone"
                type="tel"
                required
                pattern="[6-9][0-9]{9}"
                title="Enter a valid 10-digit Indian mobile number"
                value={lookupPhone}
                onChange={(event) => setLookupPhone(event.target.value)}
                placeholder="Enter the number used for booking"
              />

              <button
                className="submit-btn"
                type="submit"
                disabled={lookupLoading}
              >
                {lookupLoading ? 'Searching...' : 'Find My Booking'}
              </button>
            </form>

            {lookupResult && (
              <>
                <article
                  className="booking-item"
                  style={{ marginTop: '24px' }}
                >
                  <div>
                    <h3>{lookupResult.service}</h3>

                    <p>Farmer: {lookupResult.name}</p>
                    <p>Date: {lookupResult.date}</p>
                    <p>Farm Location: {lookupResult.location}</p>

                    {lookupResult.provider && (
                      <p>
                        <strong>Selected Provider:</strong>{' '}
                        {lookupResult.provider}
                      </p>
                    )}

                    {lookupResult.providerLocation && (
                      <p>
                        <strong>Provider Location:</strong>{' '}
                        {lookupResult.providerLocation}
                      </p>
                    )}

                    {lookupResult.price != null && (
                      <p>
                        <strong>Price:</strong> ₹{lookupResult.price}/
                        {lookupResult.priceUnit}
                      </p>
                    )}

                    <p>Booking ID: {lookupResult._id}</p>

                    {lookupResult.notes && (
                      <p>Details: {lookupResult.notes}</p>
                    )}
                  </div>

                  <span className="status-pending">
                    {lookupResult.status || 'Pending'}
                  </span>
                </article>

                {lookupResult.status === 'Pending' && (
                  <button
                    type="button"
                    className="submit-btn"
                    disabled={lookupLoading}
                    onClick={handleCancelBooking}
                    style={{
                      marginTop: '16px',
                      background: '#b42318',
                    }}
                  >
                    {lookupLoading ? 'Processing...' : 'Cancel Booking'}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* ADMIN PANEL */}

        <section
          className="bookings-section"
          id="admin"
          style={{
            background: '#f3f8f0',
            padding: '40px 5%',
          }}
        >
          <div className="section-heading">
            <span>ADMINISTRATION</span>
            <h2>Admin Panel</h2>
            <p>Manage service providers and booking requests.</p>
          </div>

          {!adminLoggedIn ? (
            <div className="booking-card">
              <h3>Admin Login</h3>

              <form onSubmit={handleAdminLogin}>
                <label htmlFor="admin-username">Username</label>

                <input
                  id="admin-username"
                  autoComplete="username"
                  required
                  value={credentials.username}
                  onChange={(event) =>
                    setCredentials((previous) => ({
                      ...previous,
                      username: event.target.value,
                    }))
                  }
                  placeholder="Enter admin username"
                />

                <label htmlFor="admin-password">Password</label>

                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={credentials.password}
                  onChange={(event) =>
                    setCredentials((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Enter admin password"
                />

                <button
                  className="submit-btn"
                  type="submit"
                  disabled={loginLoading}
                >
                  {loginLoading ? 'Logging in...' : 'Login as Admin'}
                </button>
              </form>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginBottom: '20px',
                }}
              >
                <button
                  type="button"
                  className="primary-btn"
                  onClick={async () => {
                    await fetchAdminBookings(adminToken, true);
                    await fetchAdminProviders(adminToken);
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? 'Refreshing...' : '↻ Refresh Dashboard'}
                </button>

                <button
                  type="button"
                  className="login-btn"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>

              {/* PROVIDER MANAGEMENT */}

              <h3>Registered Service Providers</h3>

              {adminProviders.length === 0 ? (
                <p className="empty-message">
                  No registered providers found.
                </p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '20px' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      background: '#fff',
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          'Name',
                          'Email',
                          'Phone',
                          'Service',
                          'Location',
                          'Price',
                          'Approval',
                          'Action',
                        ].map((heading) => (
                          <th
                            key={heading}
                            style={{
                              padding: '12px',
                              border: '1px solid #ddd',
                              textAlign: 'left',
                            }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {adminProviders.map((provider) => (
                        <tr key={provider._id}>
                          {[
                            provider.name,
                            provider.email,
                            provider.phone,
                            provider.serviceName || 'Not provided',
                            provider.providerLocation || 'Not provided',
                            provider.price != null
                              ? `₹${provider.price}/${provider.priceUnit || 'unit'}`
                              : 'Not provided',
                            provider.isApproved ? 'Approved' : 'Pending',
                          ].map((value, index) => (
                            <td
                              key={index}
                              style={{
                                padding: '12px',
                                border: '1px solid #ddd',
                              }}
                            >
                              {value}
                            </td>
                          ))}

                          <td
                            style={{
                              padding: '12px',
                              border: '1px solid #ddd',
                            }}
                          >
                            {provider.isApproved ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateProviderApproval(
                                    provider._id,
                                    false
                                  )
                                }
                              >
                                Reject
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  updateProviderApproval(
                                    provider._id,
                                    true
                                  )
                                }
                              >
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* BOOKING MANAGEMENT */}

              <h3 style={{ marginTop: '40px' }}>
                All Booking Requests
              </h3>

              {adminBookings.length === 0 ? (
                <p className="empty-message">No bookings found.</p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '24px' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      background: '#fff',
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          'Farmer',
                          'Phone',
                          'Service',
                          'Provider',
                          'Price',
                          'Date',
                          'Location',
                          'Status',
                          'Update Status',
                        ].map((heading) => (
                          <th
                            key={heading}
                            style={{
                              padding: '12px',
                              border: '1px solid #ddd',
                              textAlign: 'left',
                            }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {adminBookings.map((booking) => (
                        <tr key={booking._id}>
                          {[
                            booking.name,
                            booking.phone,
                            booking.service,
                            booking.provider || 'Not specified',
                            booking.price != null
                              ? `₹${booking.price}/${booking.priceUnit || 'unit'}`
                              : 'Not specified',
                            booking.date,
                            booking.location,
                            booking.status || 'Pending',
                          ].map((value, index) => (
                            <td
                              key={index}
                              style={{
                                padding: '12px',
                                border: '1px solid #ddd',
                              }}
                            >
                              {value}
                            </td>
                          ))}

                          <td
                            style={{
                              padding: '12px',
                              border: '1px solid #ddd',
                            }}
                          >
                            <select
                              value={booking.status || 'Pending'}
                              onChange={(event) =>
                                updateBookingStatus(
                                  booking._id,
                                  event.target.value
                                )
                              }
                              aria-label={`Update status for ${booking.name}`}
                            >
                              {bookingStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>


{/* ABOUT SECTION */}

<section className="about-section" id="about">
  <div className="about-content">
    <span className="about-tag">ABOUT KISANSATHI</span>

    <h2>
      Empowering Farmers,
      <span> Simplifying Farming</span>
    </h2>

    <p>
      KisanSathi is an integrated agricultural service platform
      that connects farmers with machinery, skilled workers and
      essential farming services in one convenient place.
    </p>

    <p>
      Our goal is to make farming services easier to discover,
      compare and book, helping farmers save time and effort.
    </p>

    <a href="#services" className="primary-btn">
      Explore Our Services →
    </a>
  </div>

  <div className="about-features">
    <div className="about-feature-card">
      <span>🚜</span>
      <h3>Easy Access</h3>
      <p>Find agricultural machinery and services in one place.</p>
    </div>

    <div className="about-feature-card">
      <span>💰</span>
      <h3>Compare Prices</h3>
      <p>Compare available providers and their service prices.</p>
    </div>

    <div className="about-feature-card">
      <span>🤝</span>
      <h3>Reliable Connections</h3>
      <p>Connect farmers with agricultural service providers.</p>
    </div>
  </div>
</section>

      </main>

      {/* FOOTER */}

      <footer>
        © {new Date().getFullYear()} KisanSathi | Supporting India's Farmers 🌱
      </footer>
    </div>
  );
}

export default App;