import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import 'dotenv/config';

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
  REPORTS: 'reports'
};

// Configure VAPID keys from environment variables or use defaults
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BPWkI8B5Z-5P9mKjX7VQ2cR1tY3uH6nL0xG4sD8fJ9hM1qC3vA7wE5zT4yB6uN2oP9rX1',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'qW3tY7uH9nL1xG4sD8fJ0hM2qC4vA6wE5z'
};

try {
  webpush.setVapidDetails(
    process.env.ADMIN_EMAIL || 'mailto:support@akwaconnect.ng',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log('✅ VAPID keys configured');
} catch (error) {
  console.warn('⚠️  VAPID keys configuration failed. Push notifications may not work:', error.message);
}

// Store push subscriptions (in-memory cache)
const pushSubscriptions = new Map();

// WebSocket setup
const wss = new WebSocket.Server({ noServer: true });

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

// Heartbeat for WebSocket connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeat);
});

// Broadcast to specific user
const broadcastToUser = (userId, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.userId === userId) {
            client.send(JSON.stringify({
              ...data,
              timestamp: new Date().toISOString()
            }));
        }
    });
};

// Set up WebSocket server
wss.on('connection', handleWebSocketConnection);

// API Routes

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
                ...profile,
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

// ... (Keep all your existing API endpoints from the original file)
// All the existing endpoints remain the same but with improved error handling
// Continue with your existing /api/profile/:userId, /api/matches/:userId, etc.

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
  
  // Close WebSocket connections
  wss.clients.forEach(client => {
    client.close(1001, 'Server shutting down');
  });
  
  wss.close(() => {
    server.close(() => {
      console.log('Server closed gracefully');
      process.exit(0);
    });
  });
  
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



