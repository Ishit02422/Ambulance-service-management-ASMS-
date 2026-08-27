# 🚑 Ambulance Booking System

A comprehensive ambulance booking platform with separate panels for Patients, Drivers, and Administrators. Built with React, Vite, and Tailwind CSS.

## Features

### 🏥 Patient Panel
- **Emergency SOS Button** - Instant ICU ambulance booking
- **Book Ambulance** - Choose from 4 types: Normal, ICU, Cardiac, Dead Body Van
- **Live Fare Calculation** - Distance-based pricing with real-time estimates
- **Booking History** - Track all past and current bookings
- **Real-time Notifications** - Get updates on booking status
- **Profile Management** - Update personal information
- **Emergency Contacts** - Quick access to emergency numbers

### 🚗 Driver Panel
- **Online/Offline Toggle** - Control availability status
- **New Booking Requests** - View and accept ride requests
- **Active Rides Management** - Update booking status (On the way, Picked, Dropped)
- **Earnings Dashboard** - Track daily and total earnings
- **Ride History** - View completed rides
- **Verification System** - Admin approval required before accepting rides
- **Real-time Updates** - Instant notifications for new bookings

### 👨‍💼 Admin Panel
- **Overview Dashboard** - Key metrics and statistics
- **User Management** - View and manage all patients
- **Driver Management** - Approve/disable drivers
- **Booking Tracking** - Monitor all bookings in real-time
- **Revenue Analytics** - Track total and daily revenue
- **Driver Verification** - Review and approve new driver applications

## Ambulance Types & Pricing

| Type | Base Fare | Per KM Rate | Use Case |
|------|-----------|-------------|----------|
| Normal | ₹200 | ₹15/km | General medical transport |
| ICU | ₹500 | ₹30/km | Critical care patients |
| Cardiac | ₹600 | ₹35/km | Heart emergency cases |
| Dead Body Van | ₹300 | ₹20/km | Deceased transport |

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Default Credentials

### Admin Account
- Email: `admin@ambulance.com`
- Password: `admin123`

### Test Patient Account
Register a new patient account through the registration form.

### Test Driver Account
1. Register as a driver with vehicle details
2. Wait for admin approval
3. Login and toggle online status

## Project Structure

```
src/
├── components/        # Reusable components
│   ├── Login.jsx
│   ├── Register.jsx
│   └── MapView.jsx
├── context/          # React context for state management
│   └── AuthContext.jsx
├── pages/            # Main application pages
│   ├── PatientDashboard.jsx
│   ├── DriverDashboard.jsx
│   └── AdminDashboard.jsx
├── utils/            # Utility functions
│   └── storage.js
├── App.tsx           # Main app component
└── main.tsx          # Entry point
```

## Features Implementation

### Authentication System
- Role-based access control (Patient, Driver, Admin)
- Secure login and registration
- Profile management
- Session persistence using localStorage

### Booking System
- Real-time booking requests
- Distance calculation
- Fare estimation
- Status tracking (Requested → Accepted → On the way → Picked → Dropped)
- Payment status management

### Notification System
- Real-time updates for booking status changes
- Driver assignment notifications
- Read/unread status tracking

### Driver Management
- Verification workflow
- Online/offline status
- Earnings tracking
- Rating system

## Technology Stack

- **Frontend**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Context API
- **Storage**: localStorage (can be replaced with Supabase)
- **Language**: JavaScript/JSX

## Future Enhancements

### Recommended Additions
1. **Google Maps Integration** - Real-time tracking and routing
2. **Supabase Backend** - Database persistence and real-time updates
3. **Push Notifications** - Browser and mobile notifications
4. **Payment Gateway** - Online payment integration (Stripe/Razorpay)
5. **SMS/Email Notifications** - Twilio integration
6. **Voice Commands** - Speech recognition for emergency booking
7. **Advanced Analytics** - Charts and graphs for admin dashboard
8. **Driver Location Tracking** - Live GPS tracking
9. **Rating & Review System** - Patient feedback for drivers
10. **Multi-language Support** - Internationalization

### Google Maps Integration Guide

To add live tracking:

1. Get Google Maps API key from Google Cloud Console
2. Install Google Maps React library:
```bash
npm install @react-google-maps/api
```

3. Replace MapView component with actual Google Maps
4. Add geolocation API for live tracking
5. Implement route calculation using Distance Matrix API

### Supabase Integration Guide

To add database persistence:

1. Create Supabase project
2. Install Supabase client:
```bash
npm install @supabase/supabase-js
```

3. Replace localStorage calls with Supabase queries
4. Set up Row Level Security policies
5. Enable real-time subscriptions for live updates

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

This project is for educational and demonstration purposes.

## Support

For issues or questions, please create an issue in the repository.

---

Built with ❤️ using React and Vite
