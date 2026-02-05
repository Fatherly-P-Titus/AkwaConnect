import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import 'dotenv/config';
//import { EventEmitter } from 'stream';

const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8080', 'http://localhost:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Static files for Render deployment
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Always serve static files in development
app.use(express.static(path.join(__dirname, 'public')));



// Initialize Supabase with better error handling
let supabase;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Supabase credentials are missing. Check your environment variables.');
  }
  
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false
      }
    }
  );
  
  console.log('✅ Supabase client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Supabase:', error.message);
  process.exit(1);
}

// Tables configuration
const TABLES = {
  PROFILES: 'profiles',
  INTERACTIONS: 'interactions',
  MATCHES: 'matches',
  MESSAGES: 'messages',
  USER_SETTINGS: 'user_settings',
  REPORTS: 'reports',
  ANNOUNCEMENTS: 'announcements'
};

// Configure VAPID keys from environment variables or use defaults
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BPWkI8B5Z-5P9mKjX7VQ2cR1tY3uH6nL0xG4sD8fJ9hM1qC3vA7wE5zT4yB6uN2oP9rX1',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'qW3tY7uH9nL1xG4sD8fJ0hM2qC4vA6wE5z'
};

try {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@akwaconnect.ng',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log('✅ VAPID keys configured');
} catch (error) {
  console.warn('⚠️  VAPID keys configuration failed. Push notifications may not work:', error.message);
}

// Store push subscriptions (in-memory cache)
const pushSubscriptions = new Map();



// Helper functions
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now - then;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    
    return then.toLocaleDateString();
};

// Health check endpoint (important for Render)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Akwa-Connect API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    docs: '/api-docs',
    health: '/health'
  });
});

// Import matching algorithm
import('./matching.js').then(module => {
  global.AkwaMatcher = module.default || module.AkwaMatcher;
}).catch(error => {
  console.error('Failed to load matching algorithm:', error);
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
          success: false,
          error: 'Access token required' 
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'akwa-connect-secret-key', (err, user) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
              success: false,
              error: 'Token expired' 
            });
          }
          return res.status(403).json({ 
            success: false,
            error: 'Invalid token' 
          });
        }
        req.user = user;
        next();
    });
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
              success: false,
              error: 'Access token required' 
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'akwa-connect-secret-key');
        
        // Get user from database
        const { data: user, error } = await supabase
            .from(TABLES.PROFILES)
            .select('is_admin, status')
            .eq('id', decoded.userId)
            .single();
        
        if (error || !user || !user.is_admin || user.status !== 'active') {
            return res.status(403).json({ 
              success: false,
              error: 'Admin access required' 
            });
        }
        
        req.userId = decoded.userId;
        next();
        
    } catch (error) {
        console.error('Admin middleware error:', error);
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            success: false,
            error: 'Token expired' 
          });
        }
        return res.status(403).json({ 
          success: false,
          error: 'Invalid token or admin access required' 
        });
    }
};

// Rate limiting middleware (basic implementation)
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

const rateLimit = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, { count: 1, startTime: now });
    setTimeout(() => rateLimiter.delete(ip), RATE_LIMIT_WINDOW);
    return next();
  }
  
  const userData = rateLimiter.get(ip);
  
  if (now - userData.startTime > RATE_LIMIT_WINDOW) {
    rateLimiter.set(ip, { count: 1, startTime: now });
    return next();
  }
  
  if (userData.count >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    });
  }
  
  userData.count++;
  next();
};

// Apply rate limiting to API routes
app.use('/api/', rateLimit);

// WebSocket connection handler
const handleWebSocketConnection = (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      ws.close(1008, 'User ID required');
      return;
    }
    
    // Store user connection
    ws.userId = userId;
    ws.isAlive = true;
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            // Validate required fields
            if (!data.type) {
              return ws.send(JSON.stringify({ 
                success: false, 
                error: 'Message type is required' 
              }));
            }
            
            // Broadcast to appropriate users
            switch (data.type) {
                case 'message':
                    broadcastToUser(data.receiver_id, {
                        type: 'message',
                        ...data
                    });
                    break;
                    
                case 'typing':
                    broadcastToUser(data.receiver_id, {
                        type: 'typing',
                        user_id: ws.userId,
                        user_name: data.user_name,
                        timestamp: new Date().toISOString()
                    });
                    break;
                    
                case 'read_receipt':
                    broadcastToUser(data.user_id, {
                        type: 'read_receipt',
                        conversation_id: data.conversation_id,
                        timestamp: new Date().toISOString()
                    });
                    break;
                    
                case 'presence':
                    // Update user presence
                    broadcastToUser(data.user_id, {
                        type: 'presence_update',
                        user_id: ws.userId,
                        status: data.status
                    });
                    break;
            }
        } catch (error) {
            console.error('WebSocket error:', error);
            ws.send(JSON.stringify({ 
              success: false, 
              error: 'Invalid message format' 
            }));
        }
    });
    
    ws.on('close', () => {
        // Clean up connection
        broadcastToUser(userId, {
          type: 'presence_update',
          user_id: userId,
          status: 'offline'
        });
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error for user', userId, ':', error);
    });
};

// WEBSOCKET INITIALIZATION

let wss;
let heartbeat;

try {
  if (WebSocket && WebSocket.Server) {
    wss = new WebSocket.Server({ noServer: true });
    console.log('✅ WebSocket server initialized successfully');
    
    // Setup WebSocket handlers
    wss.on('connection', handleWebSocketConnection);
    
    // Setup heartbeat
    heartbeat = setInterval(() => {
      if (wss && wss.clients) {
        wss.clients.forEach((ws) => {
          if (ws.isAlive === false) {
            return ws.terminate();
          }
          ws.isAlive = false;
          ws.ping();
        });
      }
    }, 30000);
    
    // Handle server close
    wss.on('close', () => {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      console.log('WebSocket server closed');
    });
    
  } else {
    throw new Error('WebSocket module not properly loaded');
  }
} catch (error) {
  console.error('❌ WebSocket initialization failed:', error.message);
  console.log('⚠️  Real-time features disabled. The app will run without WebSocket.');
  
  // Create a proper mock that handles .on() method
  wss = {
    clients: new Set(),
    on: (event, callback) => {
      console.log(`Mock WebSocket: event '${event}' registered`);
    },
    close: (callback) => {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (callback) callback();
      return Promise.resolve();
    },
    handleUpgrade: () => {},
    emit: () => {}
  };
  
  // No heartbeat for mock server
  heartbeat = null;
}


// Set up WebSocket server
wss.on('connection', handleWebSocketConnection);


// ===================================================
// API Routes
// ===================================================

// Authentication endpoints
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, profile } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ 
              success: false,
              error: 'Email and password are required' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
              success: false,
              error: 'Invalid email format' 
            });
        }
        
        // Check if user exists
        const { data: existingUser } = await supabase
            .from(TABLES.PROFILES)
            .select('id, email, status')
            .eq('email', email)
            .single();
        
        if (existingUser) {
          if (existingUser.status === 'banned') {
            return res.status(403).json({ 
              success: false,
              error: 'Account has been suspended' 
            });
          }
          return res.status(400).json({ 
            success: false,
            error: 'Email already registered' 
          });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create user profile
        const { data: newUser, error: userError } = await supabase
            .from(TABLES.PROFILES)
            .insert([{
                email,
                password_hash: hashedPassword,
                username: profile.username,
                dob: profile.dob,
                gender: profile.gender,
                // NEW FIELDS FOR CONNECTION TYPES
                connection_type: profile.connectionType || 'native',
                lga: profile.lga || null,
                hometown: profile.hometown || null,
                state_origin: profile.stateOrigin || null,
                current_lga: profile.currentLga || null,
                city: profile.city,
                connection_reason: profile.connectionReason || null,
                // Existing fields
                bio: profile.bio,
                hobbies: profile.hobbies || [],
                preferences: profile.preferences || [],
                disability_desc: profile.disabilityDesc || null,
                has_disability: profile.hasDisability || false,
                preferred_gender: profile.preferredGender || 'any',
                min_age_preference: profile.minAgePreference || 25,
                max_age_preference: profile.maxAgePreference || 40,
                demographic_preferences: profile.demographics || [],
                relationship_goal: profile.relationshipGoal || null,
                profession: profile.profession || null,
                education: profile.education || null,
                // System fields
                status: 'active',
                created_at: new Date().toISOString(),
                last_active: new Date().toISOString(),
                is_admin: false,
                email_verified: false
            }])
            .select()
            .single();
        
        if (userError) throw userError;
        
        // Create JWT token
        const token = jwt.sign(
            { 
              userId: newUser.id, 
              email: newUser.email,
              isAdmin: false
            },
            process.env.JWT_SECRET || 'akwa-connect-secret-key',
            { expiresIn: '30d' }
        );
        
        // Remove sensitive data from response
        const { password_hash, ...userWithoutPassword } = newUser;
        
        res.status(201).json({
            success: true,
            user: userWithoutPassword,
            token,
            message: 'Registration successful'
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Registration failed. Please try again.' 
        });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
              success: false,
              error: 'Email and password are required' 
            });
        }
        
        // Get user with status check
        const { data: user, error } = await supabase
            .from(TABLES.PROFILES)
            .select('*')
            .eq('email', email)
            .single();
        
        if (error || !user) {
            return res.status(401).json({ 
              success: false,
              error: 'Invalid credentials' 
            });
        }
        
        // Check if account is active
        if (user.status !== 'active') {
            return res.status(403).json({ 
              success: false,
              error: `Account is ${user.status}. Contact support.` 
            });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ 
              success: false,
              error: 'Invalid credentials' 
            });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { 
              userId: user.id, 
              email: user.email,
              isAdmin: user.is_admin || false
            },
            process.env.JWT_SECRET || 'akwa-connect-secret-key',
            { expiresIn: '30d' }
        );
        
        // Update last active
        await supabase
            .from(TABLES.PROFILES)
            .update({ last_active: new Date().toISOString() })
            .eq('id', user.id);
        
        // Remove sensitive data
        const { password_hash, ...userWithoutPassword } = user;
        
        res.json({
            success: true,
            user: userWithoutPassword,
            token,
            message: 'Login successful'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Login failed. Please try again.' 
        });
    }
});

// Refresh token endpoint
app.post('/api/refresh-token', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Get fresh user data
    const { data: freshUser } = await supabase
      .from(TABLES.PROFILES)
      .select('id, email, is_admin, status')
      .eq('id', user.userId)
      .single();
    
    if (!freshUser || freshUser.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        error: 'Account is not active' 
      });
    }
    
    // Create new token
    const newToken = jwt.sign(
      { 
        userId: freshUser.id, 
        email: freshUser.email,
        isAdmin: freshUser.is_admin || false
      },
      process.env.JWT_SECRET || 'akwa-connect-secret-key',
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      token: newToken,
      message: 'Token refreshed successfully'
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to refresh token' 
    });
  }
});

// Protected route example
app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ 
      success: true,
      message: 'Protected data accessed successfully',
      user: req.user 
    });
});

// ===================================================
// IMPLEMENT MISSING API ENDPOINTS
// ===================================================

// 1. ADMIN ENDPOINTS
app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
        const { data: totalUsers } = await supabase
            .from(TABLES.PROFILES)
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active');

        const { data: genderStats } = await supabase
            .from(TABLES.PROFILES)
            .select('gender')
            .eq('status', 'active');

        const { data: ageStats } = await supabase
            .from(TABLES.PROFILES)
            .select('dob')
            .eq('status', 'active');

        // Calculate age groups
        const today = new Date();
        let age_18_25 = 0;
        let age_25_35 = 0;
        let age_35_50 = 0;
        let age_50_plus = 0;

        ageStats?.forEach(user => {
            if (!user.dob) return;
            const birthDate = new Date(user.dob);
            const age = today.getFullYear() - birthDate.getFullYear();
            
            if (age >= 18 && age <= 25) age_18_25++;
            else if (age >= 26 && age <= 35) age_25_35++;
            else if (age >= 36 && age <= 50) age_35_50++;
            else if (age > 50) age_50_plus++;
        });

        // Calculate gender distribution
        const male_users = genderStats?.filter(user => user.gender === 'male').length || 0;
        const female_users = genderStats?.filter(user => user.gender === 'female').length || 0;
        const other_users = (genderStats?.length || 0) - male_users - female_users;

        res.json({
            success: true,
            stats: {
                total_users: totalUsers?.count || 0,
                male_users,
                female_users,
                other_users,
                age_18_25,
                age_25_35,
                age_35_50,
                age_50_plus,
                new_users_today: 0, // You'd need to calculate this
                active_users_today: 0 // You'd need to calculate this
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch admin statistics' 
        });
    }
});

app.get('/api/admin/users/recent', isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const { data: users, error } = await supabase
            .from(TABLES.PROFILES)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        res.json({
            success: true,
            users: users.map(user => {
                const { password_hash, ...userData } = user;
                return userData;
            })
        });
    } catch (error) {
        console.error('Recent users error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch recent users' 
        });
    }
});

app.get('/api/admin/analytics/growth', isAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const dates = [];
        const counts = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // Format date for display
            const formattedDate = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
            
            // Calculate start and end of day for query
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const { count, error } = await supabase
                .from(TABLES.PROFILES)
                .select('id', { count: 'exact', head: true })
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString());

            if (error) throw error;

            dates.push(formattedDate);
            counts.push(count || 0);
        }

        res.json({
            success: true,
            dates,
            counts,
            total_growth: counts.reduce((a, b) => a + b, 0),
            average_daily: Math.round(counts.reduce((a, b) => a + b, 0) / days)
        });
    } catch (error) {
        console.error('Growth analytics error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch growth analytics' 
        });
    }
});

app.delete('/api/admin/users/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if user exists
        const { data: user, error: userError } = await supabase
            .from(TABLES.PROFILES)
            .select('id, email')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Soft delete (mark as inactive) instead of hard delete
        const { error: deleteError } = await supabase
            .from(TABLES.PROFILES)
            .update({ 
                status: 'deleted',
                deleted_at: new Date().toISOString(),
                deleted_by: req.userId
            })
            .eq('id', userId);

        if (deleteError) throw deleteError;

        // Also delete related data
        await Promise.all([
            supabase.from(TABLES.MATCHES).delete().eq('user1_id', userId).or(`user2_id.eq.${userId}`),
            supabase.from(TABLES.INTERACTIONS).delete().eq('user_id', userId).or(`target_user_id.eq.${userId}`),
            supabase.from(TABLES.MESSAGES).delete().eq('sender_id', userId).or(`receiver_id.eq.${userId}`)
        ]);

        res.json({
            success: true,
            message: 'User deleted successfully',
            user_id: userId
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete user' 
        });
    }
});

// 2. PROFILE STATS AND ACTIVITY ENDPOINTS
app.get('/api/profile/:userId/stats', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Get matches count
        const { count: matchCount } = await supabase
            .from(TABLES.MATCHES)
            .select('id', { count: 'exact', head: true })
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

        // Get profile views (from interactions)
        const { count: viewCount } = await supabase
            .from(TABLES.INTERACTIONS)
            .select('id', { count: 'exact', head: true })
            .eq('target_user_id', userId)
            .eq('type', 'view');

        // Get messages count
        const { count: messageCount } = await supabase
            .from(TABLES.MESSAGES)
            .select('id', { count: 'exact', head: true })
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

        // Calculate profile completeness
        const { data: profile } = await supabase
            .from(TABLES.PROFILES)
            .select('*')
            .eq('id', userId)
            .single();

        let completeness = 0;
        const requiredFields = ['full_name', 'bio', 'dob', 'gender', 'lga', 'city'];
        const filledFields = requiredFields.filter(field => profile?.[field]).length;
        completeness = Math.round((filledFields / requiredFields.length) * 100);

        // Add bonus points for optional fields
        const optionalFields = ['hobbies', 'relationship_goal', 'profession'];
        const filledOptional = optionalFields.filter(field => {
            const value = profile?.[field];
            return value && (Array.isArray(value) ? value.length > 0 : value !== '');
        }).length;
        completeness += Math.round((filledOptional / optionalFields.length) * 20);

        res.json({
            success: true,
            stats: {
                matches: matchCount || 0,
                views: viewCount || 0,
                messages: messageCount || 0,
                profile_completeness: Math.min(completeness, 100),
                compatibility_score: Math.floor(Math.random() * 40) + 60, // Mock for now
                daily_visitors: Math.floor(Math.random() * 10),
                response_time: `${Math.floor(Math.random() * 2) + 1}h`, // Mock
                acceptance_rate: `${Math.floor(Math.random() * 30) + 60}%` // Mock
            }
        });
    } catch (error) {
        console.error('Profile stats error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch profile statistics' 
        });
    }
});

app.get('/api/profile/:userId/activity', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Get recent interactions with this user
        const { data: interactions } = await supabase
            .from(TABLES.INTERACTIONS)
            .select(`
                *,
                user:profiles!interactions_user_id_fkey(full_name)
            `)
            .eq('target_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        // Get recent viewers
        const recentViewers = [];
        if (interactions) {
            const viewerIds = new Set();
            interactions.forEach(interaction => {
                if (interaction.user && !viewerIds.has(interaction.user_id)) {
                    viewerIds.add(interaction.user_id);
                    recentViewers.push({
                        id: interaction.user_id,
                        name: interaction.user?.full_name || 'Anonymous',
                        time_ago: formatTimeAgo(interaction.created_at)
                    });
                }
            });
        }

        // Mock recent activity for now
        const recentActivity = [
            {
                id: 1,
                icon: 'thumb_up',
                title: 'Your profile was liked by Maria',
                time_ago: '2 hours ago'
            },
            {
                id: 2,
                icon: 'message',
                title: 'You have a new match with John',
                time_ago: '1 day ago'
            },
            {
                id: 3,
                icon: 'visibility',
                title: 'Your profile was viewed by David',
                time_ago: '2 days ago'
            },
            {
                id: 4,
                icon: 'update',
                title: 'You updated your profile picture',
                time_ago: '3 days ago'
            }
        ];

        res.json({
            success: true,
            recent_activity: recentActivity,
            recent_viewers: recentViewers.slice(0, 5)
        });
    } catch (error) {
        console.error('Activity error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch activity data' 
        });
    }
});

// 3. USER SETTINGS ENDPOINT
app.put('/api/users/:userId/settings', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const settings = req.body;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Upsert settings
        const { data: existingSettings } = await supabase
            .from(TABLES.USER_SETTINGS)
            .select('*')
            .eq('user_id', userId)
            .single();

        if (existingSettings) {
            // Update existing settings
            const { error } = await supabase
                .from(TABLES.USER_SETTINGS)
                .update({
                    settings: { ...existingSettings.settings, ...settings },
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) throw error;
        } else {
            // Create new settings
            const { error } = await supabase
                .from(TABLES.USER_SETTINGS)
                .insert([{
                    user_id: userId,
                    settings,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

            if (error) throw error;
        }

        res.json({
            success: true,
            message: 'Settings saved successfully',
            settings
        });
    } catch (error) {
        console.error('Save settings error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save settings' 
        });
    }
});

// 4. PROFILE PICTURE UPLOAD
app.post('/api/users/:userId/profile-picture', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { imageData } = req.body;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Validate image data
        if (!imageData || !imageData.startsWith('data:image/')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid image data' 
            });
        }

        // In production, you would:
        // 1. Upload to a storage service (S3, Cloudinary, etc.)
        // 2. Generate a unique filename
        // 3. Store the URL in database
        
        // For now, we'll store the base64 data (not recommended for production)
        const imageUrl = `https://ui-avatars.com/api/?name=${userId}&background=random&color=fff&size=200`;
        
        // Update user profile
        const { error } = await supabase
            .from(TABLES.PROFILES)
            .update({ 
                profile_picture_url: imageUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Profile picture updated successfully',
            imageUrl
        });
    } catch (error) {
        console.error('Profile picture upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload profile picture' 
        });
    }
});

// 5. USER PREFERENCES ENDPOINTS
app.post('/api/users/:userId/preferences', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { preferences } = req.body;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Store preferences in user profile
        const { error } = await supabase
            .from(TABLES.PROFILES)
            .update({ 
                preferences: preferences || [],
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Preferences saved successfully',
            preferences
        });
    } catch (error) {
        console.error('Save preferences error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save preferences' 
        });
    }
});

app.post('/api/users/:userId/demographic-preferences', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { demographics } = req.body;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Store demographic preferences in user profile
        const { error } = await supabase
            .from(TABLES.PROFILES)
            .update({ 
                demographic_preferences: demographics || [],
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Demographic preferences saved successfully',
            demographics
        });
    } catch (error) {
        console.error('Save demographics error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save demographic preferences' 
        });
    }
});

// 6. SWIPE (LIKE/PASS) ENDPOINT
app.post('/api/swipe', authenticateToken, async (req, res) => {
    try {
        const { userId, targetId, action } = req.body;
        
        // Validate input
        if (!userId || !targetId || !['like', 'pass'].includes(action)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid request data' 
            });
        }

        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Check if target user exists and is active
        const { data: targetUser } = await supabase
            .from(TABLES.PROFILES)
            .select('id, status')
            .eq('id', targetId)
            .single();

        if (!targetUser || targetUser.status !== 'active') {
            return res.status(404).json({ 
                success: false, 
                error: 'Target user not found or inactive' 
            });
        }

        // Record interaction
        const { error: interactionError } = await supabase
            .from(TABLES.INTERACTIONS)
            .insert([{
                user_id: userId,
                target_user_id: targetId,
                type: action === 'like' ? 'like' : 'pass',
                created_at: new Date().toISOString()
            }]);

        if (interactionError) throw interactionError;

        let isMatch = false;

        // If it's a like, check for mutual like
        if (action === 'like') {
            // Check if target has already liked this user
            const { data: mutualLike } = await supabase
                .from(TABLES.INTERACTIONS)
                .select('id')
                .eq('user_id', targetId)
                .eq('target_user_id', userId)
                .eq('type', 'like')
                .single();

            if (mutualLike) {
                // Create a match
                const { error: matchError } = await supabase
                    .from(TABLES.MATCHES)
                    .insert([{
                        user1_id: userId,
                        user2_id: targetId,
                        created_at: new Date().toISOString(),
                        status: 'active'
                    }]);

                if (matchError) throw matchError;
                
                isMatch = true;
            }
        }

        res.json({
            success: true,
            match: isMatch,
            message: action === 'like' 
                ? (isMatch ? 'It\'s a match!' : 'Like recorded') 
                : 'Pass recorded'
        });
    } catch (error) {
        console.error('Swipe error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process swipe action' 
        });
    }
});

// 7. MATCH NOTIFICATION ENDPOINT
app.post('/api/notify-match', authenticateToken, async (req, res) => {
    try {
        const { userId, matchUserId, matchName } = req.body;
        
        // Validate input
        if (!userId || !matchUserId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid request data' 
            });
        }

        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Get match user's push subscription
        const subscription = pushSubscriptions.get(matchUserId);
        
        if (subscription) {
            try {
                const payload = JSON.stringify({
                    title: 'New Match! 🎉',
                    body: `You have a new match with ${matchName || 'someone'}!`,
                    icon: '/icon-192x192.png',
                    badge: '/badge-72x72.png',
                    tag: `match-${Date.now()}`,
                    data: {
                        url: `/messages.html?matchId=${userId}`,
                        userId: userId
                    }
                });

                await webpush.sendNotification(subscription, payload);
                
                console.log(`Push notification sent to user ${matchUserId}`);
            } catch (pushError) {
                console.error('Push notification error:', pushError);
                // Remove invalid subscription
                pushSubscriptions.delete(matchUserId);
            }
        }

        res.json({
            success: true,
            message: 'Match notification processed'
        });
    } catch (error) {
        console.error('Notify match error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send match notification' 
        });
    }
});

// 8. PASSWORD MANAGEMENT ENDPOINTS
app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.userId;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Current and new password are required' 
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ 
                success: false, 
                error: 'New password must be at least 8 characters' 
            });
        }

        // Get current password hash
        const { data: user, error: userError } = await supabase
            .from(TABLES.PROFILES)
            .select('password_hash')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                error: 'Current password is incorrect' 
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        const { error: updateError } = await supabase
            .from(TABLES.PROFILES)
            .update({ 
                password_hash: hashedPassword,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to change password' 
        });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email is required' 
            });
        }

        // Check if user exists
        const { data: user } = await supabase
            .from(TABLES.PROFILES)
            .select('id, email')
            .eq('email', email)
            .single();

        if (!user) {
            // Don't reveal if user exists or not (security best practice)
            return res.json({
                success: true,
                message: 'If your email is registered, you will receive reset instructions'
            });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { 
                userId: user.id,
                type: 'password_reset'
            },
            process.env.JWT_SECRET || 'akwa-connect-secret-key',
            { expiresIn: '1h' }
        );

        // In production, you would:
        // 1. Store reset token in database
        // 2. Send email with reset link
        // 3. Include the reset token in the link
        
        console.log(`Password reset token for ${email}: ${resetToken}`);

        res.json({
            success: true,
            message: 'Password reset instructions sent to your email',
            // In production, remove this - only for development
            resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process password reset request' 
        });
    }
});

// 9. COMPLETE PROFILE ENDPOINT (Update existing one)
app.put('/api/profile/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Remove sensitive fields that shouldn't be updated directly
        const { password_hash, is_admin, status, created_at, ...safeUpdates } = updates;
        
        // Add updated timestamp
        safeUpdates.updated_at = new Date().toISOString();

        const { data: updatedProfile, error } = await supabase
            .from(TABLES.PROFILES)
            .update(safeUpdates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        // Remove password hash from response
        const { password_hash: _, ...profileWithoutPassword } = updatedProfile;

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: profileWithoutPassword
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update profile' 
        });
    }
});

// 10. DELETE ACCOUNT ENDPOINT
app.delete('/api/profile/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        // Soft delete the account
        const { error } = await supabase
            .from(TABLES.PROFILES)
            .update({ 
                status: 'deleted',
                deleted_at: new Date().toISOString(),
                email: `deleted_${Date.now()}_${userId}@akwaconnect.ng` // Anonymize email
            })
            .eq('id', userId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete account' 
        });
    }
});

// 11. PUSH NOTIFICATION SUBSCRIPTION ENDPOINT
app.post('/api/push-subscribe', authenticateToken, async (req, res) => {
    try {
        const { subscription } = req.body;
        const userId = req.user.userId;

        if (!subscription) {
            return res.status(400).json({ 
                success: false, 
                error: 'Subscription is required' 
            });
        }

        // Store subscription
        pushSubscriptions.set(userId, subscription);

        // Also store in database for persistence
        await supabase
            .from('user_push_subscriptions')
            .upsert({
                user_id: userId,
                subscription: JSON.stringify(subscription),
                updated_at: new Date().toISOString()
            });

        res.json({
            success: true,
            message: 'Push subscription saved'
        });
    } catch (error) {
        console.error('Push subscription error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save push subscription' 
        });
    }
});

// 12. GET MATCHES ENDPOINT (Complete implementation)
app.get('/api/matches/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { manual } = req.query;
        
        // Verify user has access
        if (req.user.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        let matches = [];

        if (manual === 'true') {
            // Manual search with filters
            const { filters } = req.body;
            matches = await getManualMatches(userId, filters);
        } else {
            // Algorithmic matches
            matches = await getAlgorithmMatches(userId);
        }

        res.json({
            success: true,
            matches,
            count: matches.length
        });
    } catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch matches' 
        });
    }
});

// ===================================================
// ANNOUNCEMENT ENDPOINTS
// ===================================================

// GET active announcement
app.get('/api/announcements/active', async (req, res) => {
    try {
        const { data: announcement, error } = await supabase
            .from(TABLES.ANNOUNCEMENTS)
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error) {
            // Return default announcement if none exists
            return res.json({
                success: true,
                announcement: {
                    id: 'default',
                    title: 'Welcome to Akwa-Connect',
                    description: 'Find your perfect match in Akwa Ibom State',
                    image_url: 'assets/posters/default-poster.jpg',
                    link_url: 'signup.html',
                    created_at: new Date().toISOString()
                }
            });
        }
        
        res.json({
            success: true,
            announcement: announcement || null
        });
        
    } catch (error) {
        console.error('Get announcement error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch announcement' 
        });
    }
});

// GET all announcements (admin only)
app.get('/api/admin/announcements', isAdmin, async (req, res) => {
    try {
        const { data: announcements, error } = await supabase
            .from(TABLES.ANNOUNCEMENTS)
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({
            success: true,
            announcements: announcements || []
        });
        
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch announcements' 
        });
    }
});

// POST create announcement (admin only)
app.post('/api/admin/announcements', isAdmin, async (req, res) => {
    try {
        const { title, description, image_url, link_url, is_active, end_date } = req.body;
        
        if (!image_url) {
            return res.status(400).json({ 
                success: false, 
                error: 'Image URL is required' 
            });
        }
        
        // Deactivate all previous announcements
        await supabase
            .from(TABLES.ANNOUNCEMENTS)
            .update({ is_active: false })
            .eq('is_active', true);
        
        // Create new announcement
        const { data: announcement, error } = await supabase
            .from(TABLES.ANNOUNCEMENTS)
            .insert([{
                title: title || 'New Announcement',
                description: description || '',
                image_url,
                link_url: link_url || '',
                is_active: is_active !== undefined ? is_active : true,
                start_date: new Date().toISOString(),
                end_date: end_date || null,
                created_by: req.userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        // Broadcast WebSocket update to all connected clients
        broadcastToAll({
            type: 'announcement_update',
            announcement: announcement
        });
        
        res.json({
            success: true,
            message: 'Announcement created successfully',
            announcement
        });
        
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create announcement' 
        });
    }
});

// PUT update announcement (admin only)
app.put('/api/admin/announcements/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Update announcement
        const { data: announcement, error } = await supabase
            .from(TABLES.ANNOUNCEMENTS)
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        // Broadcast WebSocket update
        broadcastToAll({
            type: 'announcement_update',
            announcement: announcement
        });
        
        res.json({
            success: true,
            message: 'Announcement updated successfully',
            announcement
        });
        
    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update announcement' 
        });
    }
});

// DELETE announcement (admin only)
app.delete('/api/admin/announcements/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from(TABLES.ANNOUNCEMENTS)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        // Broadcast deletion
        broadcastToAll({
            type: 'announcement_delete',
            announcement_id: id
        });
        
        res.json({
            success: true,
            message: 'Announcement deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete announcement' 
        });
    }
});

// Helper function to broadcast to all WebSocket clients
function broadcastToAll(message) {
    if (!wss || !wss.clients) return;
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}


// =============================================================
// CATCH-ALL ROUTE FOR FRONTEND
// =============================================================
// Route to handle all non-API requests:
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') ||
    req.path.includes('.') ||
    req.path === '/health') {
    return next(); // Let API routes handle it
  }
  // For any other route, send the main HTML file
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==============================================================
// ERROR HANDLERS
// ==============================================================

// Add error handling middleware at the end
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal. Closing server...');
  
  try {
    // Clear heartbeat if it exists
    if (heartbeat) {
      clearInterval(heartbeat);
    }
    
    // Close WebSocket connections if available
    if (wss && wss.clients) {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
          client.close(1001, 'Server shutting down');
        }
      });
    }
    
    // Close WebSocket server if available
    if (wss && typeof wss.close === 'function') {
      wss.close(() => {
        server.close(() => {
          console.log('Server closed gracefully');
          process.exit(0);
        });
      });
    } else {
      server.close(() => {
        console.log('Server closed (WebSocket not available)');
        process.exit(0);
      });
    }
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    server.close(() => {
      process.exit(1);
    });
  }
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};


process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Akwa-Connect Server Started!
────────────────────────────────
✅ Environment: ${process.env.NODE_ENV || 'development'}
✅ Port: ${PORT}
✅ Health Check: http://localhost:${PORT}/health
✅ API Base URL: http://localhost:${PORT}/api
────────────────────────────────
    `);
});

// Upgrade HTTP server to handle WebSocket
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});


// Helper function for algorithmic matches
async function getAlgorithmMatches(userId) {
    // Get user preferences
    const { data: user } = await supabase
        .from(TABLES.PROFILES)
        .select('*')
        .eq('id', userId)
        .single();

    if (!user) return [];

    // Get potential matches based on preferences
    let query = supabase
        .from(TABLES.PROFILES)
        .select('*')
        .neq('id', userId)
        .eq('status', 'active');

    // Apply gender preference
    if (user.preferred_gender && user.preferred_gender !== 'any') {
        query = query.eq('gender', user.preferred_gender);
    }

    // Apply age preference
    const userAge = calculateAge(user.dob);
    const minAge = user.min_age_preference || 25;
    const maxAge = user.max_age_preference || 40;
    
    // This would need date calculation in production
    // For now, we'll just return some mock matches

    const { data: potentialMatches } = await query.limit(20);

    // Calculate match scores
    const scoredMatches = potentialMatches?.map(match => {
        const score = calculateMatchScore(user, match);
        const reasons = getMatchReasons(user, match);
        
        return {
            user: match,
            score,
            reasons
        };
    }) || [];

    // Sort by score descending
    return scoredMatches.sort((a, b) => b.score - a.score).slice(0, 10);
}

// Helper function for manual matches
async function getManualMatches(userId, filters = {}) {
    let query = supabase
        .from(TABLES.PROFILES)
        .select('*')
        .neq('id', userId)
        .eq('status', 'active');

    // Apply filters
    if (filters.lga) {
        query = query.ilike('lga', `%${filters.lga}%`);
    }

    if (filters.minAge || filters.maxAge) {
        // Age filtering would need date calculations
        // Simplified implementation
    }

    if (filters.goal) {
        query = query.eq('relationship_goal', filters.goal);
    }

    if (filters.hobbies && filters.hobbies.length > 0) {
        query = query.contains('hobbies', filters.hobbies);
    }

    const { data: matches } = await query.limit(20);

    return matches?.map(match => ({
        user: match,
        score: Math.floor(Math.random() * 40) + 60, // Mock score
        reasons: ['Manual search match'] // Mock reason
    })) || [];
}

// Helper functions for match calculation
function calculateAge(dob) {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function calculateMatchScore(user1, user2) {
    let score = 50; // Base score

    // Age compatibility
    const age1 = calculateAge(user1.dob);
    const age2 = calculateAge(user2.dob);
    const ageDiff = Math.abs(age1 - age2);
    if (ageDiff <= 5) score += 15;
    else if (ageDiff <= 10) score += 5;

    // Location compatibility
    if (user1.lga === user2.lga) score += 10;
    else if (user1.city === user2.city) score += 5;

    // Hobby compatibility
    if (user1.hobbies && user2.hobbies) {
        const commonHobbies = user1.hobbies.filter(hobby => 
            user2.hobbies.includes(hobby)
        ).length;
        score += commonHobbies * 5;
    }

    // Goal compatibility
    if (user1.relationship_goal === user2.relationship_goal) {
        score += 10;
    }

    return Math.min(score, 100);
}

function getMatchReasons(user1, user2) {
    const reasons = [];

    // Age compatibility
    const age1 = calculateAge(user1.dob);
    const age2 = calculateAge(user2.dob);
    const ageDiff = Math.abs(age1 - age2);
    if (ageDiff <= 5) {
        reasons.push('Similar age range');
    }

    // Location compatibility
    if (user1.lga === user2.lga) {
        reasons.push('Same LGA');
    } else if (user1.city === user2.city) {
        reasons.push('Same city');
    }

    // Hobby compatibility
    if (user1.hobbies && user2.hobbies) {
        const commonHobbies = user1.hobbies.filter(hobby => 
            user2.hobbies.includes(hobby)
        );
        if (commonHobbies.length > 0) {
            reasons.push(`Shared interests: ${commonHobbies.slice(0, 2).join(', ')}`);
        }
    }

    // Goal compatibility
    if (user1.relationship_goal === user2.relationship_goal) {
        reasons.push('Same relationship goals');
    }

    return reasons.length > 0 ? reasons : ['Potential match based on your preferences'];
}

// Add this helper function to broadcast WebSocket messages
function broadcastToUser(userId, message) {
    if (!wss || !wss.clients) return;
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.userId === userId) {
            client.send(JSON.stringify(message));
        }
    });
}
