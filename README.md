
Akwa-Connect 🌴❤️

A culturally-tailored dating platform connecting singles across Akwa Ibom State, Nigeria.


✨ Overview

Akwa-Connect is a specialized dating platform designed specifically for the people of Akwa Ibom State, Nigeria. Our platform focuses on creating meaningful connections based on shared cultural values, local preferences, and community-focused matching algorithms.

🎯 Target Audience

· Professionals (25-40 years)
· Single Parents
· Academic Community (UNIUYO, AKSU, etc.)
· Local Residents across all 31 LGAs

🚀 Features

🤝 Smart Matching System

· Dual Matching Modes: Algorithm-based & manual search
· Preference-based Algorithm: Weighted scoring across 5 compatibility factors
· Localized Matching: Priority for same LGA/cluster matching
· Special Group Optimization: Tailored algorithms for single parents, academics, and professionals

👤 User Profiles

· Complete profile creation with local cultural elements
· Up to 5 hobbies selection
· Detailed bio (500 characters)
· Relationship preferences specification
· Accessibility information (optional)

💬 Real-Time Communication

· Instant match notifications
· Real-time chat with WebSocket support
· Icebreaker suggestions
· Typing indicators
· Read receipts

🔍 Search & Discovery

· Advanced manual filters (LGA, age, hobbies, relationship goals)
· Daily algorithm-curated matches
· Profile viewing history
· Compatibility breakdowns

🛡️ Safety & Privacy

· Dealbreaker system for incompatibilities
· User blocking functionality
· Privacy settings
· Secure authentication

🎨 Design & UI

Theme

· Primary Colors: Emerald Green (#10b981) + Gold (#f59e0b)
· Font Family: Cinzel (elegant serif) + Material Icons
· Design Style: Playful & colorful with cultural elements

Responsive Design

· Mobile-first approach
· Materialize CSS framework
· Touch-friendly swipe interface
· Progressive Web App ready

🏗️ Architecture

Tech Stack

Frontend:

· HTML5, CSS3, Vanilla JavaScript
· Materialize CSS Framework
· Chart.js for analytics
· Slick Carousel

Backend:

· Node.js with Express.js
· WebSocket for real-time chat
· RESTful API design

Database:

· Supabase (PostgreSQL)
· Real-time subscriptions
· Row Level Security (RLS)

Hosting:

· Frontend: GitHub Pages
· Backend: Render (Free Tier)
· Database: Supabase (Free Tier)

📁 Project Structure

```
akwa-connect/
├── index.html              # Landing page
├── signup.html             # Registration
├── profile.html            # User profile
├── matches.html            # Matching interface
├── messages.html           # Chat system
├── styles/
│   ├── style.css          # Custom styles
│   └── materialize.min.css
├── scripts/
│   ├── main.js            # Main app logic
│   ├── auth.js            # Authentication
│   ├── matching.js        # Matching algorithm
│   ├── matches.js         # Match interface
│   ├── profile.js         # Profile management
│   └── messages.js        # Chat system
└── backend/
    ├── server.js          # Express API server
    ├── package.json       # Dependencies
    └── .env              # Environment variables
```

🔧 Installation & Setup

Prerequisites

· Node.js 14+
· Git
· Supabase account
· GitHub account
· Render account

Local Development

1. Clone the repository

```bash
git clone https://github.com/yourusername/akwa-connect.git
cd akwa-connect
```

1. Set up Supabase Database

· Create new project at supabase.com
· Run SQL scripts from /backend/schema.sql
· Get your project URL and anon key

1. Configure Backend

```bash
cd backend
npm install
```

Create .env file:

```env
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_anon_key
PORT=3000
```

1. Start Development Servers

```bash
# Backend API
cd backend
npm start

# Frontend (using live server)
# Open index.html with live server extension
```

Deployment

Frontend (GitHub Pages):

1. Push code to GitHub repository
2. Go to Settings → Pages
3. Select main branch as source
4. Your site will be live at https://username.github.io/akwa-connect

Backend (Render):

1. Create new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables
4. Build Command: npm install
5. Start Command: node server.js

🗄️ Database Schema

Core Tables

1. profiles - User information and preferences
2. interactions - Like/pass actions
3. matches - Mutual connections
4. messages - Chat history
5. profile_views - View tracking

Key Indexes for Performance

· Location-based indexes for LGA matching
· Age range indexes for demographic filtering
· Real-time enabled tables for chat

🤖 Matching Algorithm

Compatibility Scoring (0-100 points)

1. Location (30%) - LGA proximity, regional clusters
2. Preferences (25%) - Relationship goals, age preferences
3. Hobbies (20%) - Shared interests
4. Demographics (15%) - Age, education, life stage
5. Bio Similarity (10%) - Profile content analysis

Specialized Matchers

· Academic Community Matcher: Institution and field of study compatibility
· Single Parent Optimizer: Shared parenting experiences
· Professional Networker: Career and lifestyle alignment

Dealbreaker System

· Incompatible relationship goals
· Age outside preference range
· Blocked users
· Major lifestyle mismatches

🔐 Security Features

· Authentication: Supabase Auth with email/password
· Authorization: Row Level Security (RLS) policies
· Input Validation: Client and server-side validation
· XSS Prevention: Content sanitization
· CORS: Configured for specific origins
· HTTPS: Enforced in production

📱 API Endpoints

Authentication

· POST /api/signup - User registration
· POST /api/login - User login

Matching

· GET /api/matches/:userId - Get algorithm matches
· POST /api/matches/:userId - Manual search with filters
· POST /api/swipe - Record like/pass actions

Profiles

· GET /api/profile/:userId - Get user profile
· PUT /api/profile/:userId - Update profile
· GET /api/profile/:userId/stats - User statistics
· GET /api/profile/:userId/activity - Recent activity

Messaging

· GET /api/conversations/:userId - Get conversations
· GET /api/conversations/:conversationId/messages - Get messages
· POST /api/messages - Send message
· POST /api/conversations/:conversationId/read - Mark as read

WebSocket

· ws://your-backend-url/ws?userId=xxx - Real-time chat

🚦 Usage Guide

For Users

1. Sign Up: Create account with local information
2. Complete Profile: Add hobbies, preferences, and bio
3. Find Matches: Use algorithm or manual search
4. Connect: Like profiles to find mutual matches
5. Chat: Start conversations with matches
6. Manage: Update preferences and privacy settings

For Administrators

1. Monitor matches through Supabase dashboard
2. Update algorithm weights based on success rates
3. Manage user reports and moderation
4. Analyze matching patterns and success metrics

📊 Performance Optimization

Frontend

· Lazy loading of profile images
· Cached user data in localStorage
· Optimized bundle size
· Service worker for offline capability

Backend

· Database connection pooling
· Query optimization with indexes
· Cached frequent queries
· Efficient WebSocket management

Database

· Materialized views for daily match pools
· Proper indexing strategy
· Partitioning for large tables
· Regular vacuum and analyze

🔄 Development Roadmap

Phase 1 (Complete) ✅

· Basic matching algorithm
· User profiles and authentication
· Real-time chat
· Manual search filters

Phase 2 (Planned) 🔄

· Mobile app (React Native)
· Video calling feature
· Group events and meetups
· Enhanced verification system

Phase 3 (Future) 📅

· AI-powered match suggestions
· Community forums
· Success stories showcase
· Premium subscription features

🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

Development Guidelines

· Follow existing code style
· Add tests for new features
· Update documentation
· Ensure mobile responsiveness
· Test across different LGAs

📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments

· Akwa Ibom State Government - For promoting local tech initiatives
· Supabase - For the excellent free-tier database service
· Render - For free backend hosting
· Materialize CSS - For the responsive framework
· All Contributors - Who help make Akwa-Connect better

📞 Support & Contact

Having issues? Here's how to get help:

1. Documentation: Check this README and code comments
2. Issues: Open a GitHub issue with detailed description
3. Community: Join our (future) community forum
4. Email: support@akwaconnect.ng (placeholder)

🌐 Live Demo

Frontend: https://yourusername.github.io/akwa-connect
API Documentation: https://your-backend.onrender.com/api-docs

---

Made with ❤️ for the people of Akwa Ibom State

"Connecting hearts across the Land of Promise"
