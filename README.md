Akwa-Connect 🌴❤️

A culturally-tailored dating platform connecting singles across Akwa Ibom State, Nigeria.


---

✨ Overview

Akwa-Connect is a specialized dating platform designed to foster meaningful connections rooted in shared cultural values, local traditions, and community-focused compatibility. Built for the people of Akwa Ibom State, Nigeria, the platform blends modern matchmaking technology with a deep understanding of local social dynamics.

---

🎯 Target Audience

· Professionals (25–40 years)
· Single Parents
· Academic Community (UNIUYO, AKSU, etc.)
· Residents across all 31 Local Government Areas (LGAs)

---

🚀 Key Features

🤝 Smart Matching System

· Dual Matching Modes: Algorithm-based suggestions + manual search
· Preference-Based Algorithm: Weighted scoring across 5 compatibility factors
· Localized Matching: Prioritizes connections within the same LGA or regional cluster
· Special Group Optimization: Tailored algorithms for single parents, academics, and professionals

👤 Rich User Profiles

· Cultural elements reflecting Akwa Ibom heritage
· Up to 5 hobbies selection
· Detailed bio (500 characters)
· Relationship preferences & accessibility info

💬 Real-Time Communication

· Instant match notifications
· WebSocket-powered chat with typing indicators & read receipts
· Icebreaker suggestions to start conversations smoothly

🔍 Advanced Search & Discovery

· Manual filters (LGA, age, hobbies, relationship goals)
· Daily curated matches via algorithm
· Profile viewing history & compatibility breakdowns

🛡️ Safety & Privacy

· Dealbreaker system for incompatibility
· User blocking & privacy controls
· Secure authentication with Supabase Auth
· Row-Level Security (RLS) policies

🎨 Culturally-Inspired Design

· Color Theme: Emerald Green (#10b981) + Gold (#f59e0b)
· Typography: Cinzel (elegant serif) + Material Icons
· Responsive Layout: Mobile-first, built with Materialize CSS
· PWA-Ready: Installable, offline-capable experience

---

🏗️ Architecture

Tech Stack

Layer Technology
Frontend HTML5, CSS3, Vanilla JS, Materialize CSS, Chart.js, Slick Carousel
Backend Node.js, Express.js, WebSocket
Database Supabase (PostgreSQL) with RLS
Hosting GitHub Pages (Frontend), Render (Backend)

Project Structure

```
akwa-connect/
├── frontend/
│   ├── index.html          # Landing
│   ├── signup.html         # Registration
│   ├── profile.html        # Profile management
│   ├── matches.html        # Matching interface
│   ├── messages.html       # Chat system
│   ├── styles/             # CSS files
│   └── scripts/            # JS modules
└── backend/
    ├── server.js           # Express server
    ├── routes/             # API endpoints
    ├── schema.sql          # Database setup
    └── package.json        # Dependencies
```

---

🔧 Setup & Deployment

Prerequisites

· Node.js 14+
· Git
· Supabase, GitHub, and Render accounts

Local Development

1. Clone the repo:
   ```bash
   git clone https://github.com/yourusername/akwa-connect.git
   cd akwa-connect
   ```
2. Set up Supabase:
   · Create project at supabase.com
   · Run schema.sql to create tables
   · Copy SUPABASE_URL and SUPABASE_KEY
3. Configure backend:
   ```bash
   cd backend
   npm install
   echo "SUPABASE_URL=your_url" > .env
   echo "SUPABASE_KEY=your_key" >> .env
   echo "PORT=3000" >> .env
   ```
4. Start servers:
   ```bash
   npm start                 # Backend
   # Use Live Server for frontend (open index.html)
   ```

Production Deployment

· Frontend: Push to GitHub → Settings → Pages → Select main branch
· Backend: Connect repo to Render → Set env variables → Deploy
· Database: Supabase (free tier) with RLS enabled

---

🗄️ Database Schema

Core Tables: profiles, interactions, matches, messages, profile_views
Indexes: Optimized for location, age, and real-time queries.

---

🤖 Matching Algorithm

Compatibility Score (0–100)

1. Location (30%) – LGA proximity & regional clustering
2. Preferences (25%) – Relationship goals & age range
3. Hobbies (20%) – Shared interests
4. Demographics (15%) – Age, education, life stage
5. Bio Similarity (10%) – NLP-based profile analysis

Specialized Matchers:

· Academic community (institution/field)
· Single parent (shared parenting experience)
· Professional (career/lifestyle alignment)

Dealbreakers: Incompatible goals, age mismatches, blocked users.

---

🔐 Security

· Supabase Auth with email/password
· Row-Level Security (RLS)
· Input validation & XSS prevention
· CORS configured for trusted origins
· HTTPS enforcement in production

---

📡 API Endpoints

Method Endpoint Description
POST /api/signup User registration
POST /api/login User login
GET /api/matches/:userId Algorithmic matches
POST /api/matches/:userId Manual search
GET /api/profile/:userId Get profile
PUT /api/profile/:userId Update profile
GET /api/conversations/:userId List conversations
POST /api/messages Send message
WS /ws?userId=xxx Real-time chat

---

📈 Performance

· Frontend: Lazy loading, localStorage caching, service worker
· Backend: Connection pooling, query caching, indexed searches
· Database: Materialized views, partitioning, regular maintenance

---

🗺️ Development Roadmap

✅ Phase 1 (Completed)

Core matching, profiles, auth, real-time chat, manual search.

🔄 Phase 2 (In Progress)

Mobile app (React Native), video calls, group events, enhanced verification.

📅 Phase 3 (Planned)

AI-powered suggestions, community forums, success stories, premium features.

---

🤝 Contributing

We welcome contributions!

1. Fork the repository
2. Create a feature branch (git checkout -b feature/AmazingFeature)
3. Commit changes (git commit -m 'Add AmazingFeature')
4. Push to branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

Guidelines: Follow existing code style, add tests, update docs, ensure mobile responsiveness.

---

📄 License

Distributed under the MIT License. See LICENSE for details.

---

🙏 Acknowledgments

· Akwa Ibom State Government
· Supabase for database services
· Render for backend hosting
· Materialize CSS for styling
· All contributors & community members

---

📞 Support

· Docs: Refer to this README and code comments
· Issues: Open a GitHub Issue
· Email: support@akwaconnect.ng (placeholder)

---

🌐 Live Demo

· Frontend: https://akwaconnect.github.io/akwa-connect
· API Docs: https://akwaconnect-backend.onrender.com/api-docs

---

Developer: Fatherly P. Titus
Project Started: 23/01/2026
Project Launched: 27/02/2026

---

Made with ❤️ for the people of Akwa Ibom State
“Connecting hearts across the Land of Promise”
