import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// User profiles table
const USERS_TABLE = 'profiles';

// Configure VAPID keys
const vapidKeys = {
  publicKey: 'BPWkI8B5Z-5P9mKjX7VQ2cR1tY3uH6nL0xG4sD8fJ9hM1qC3vA7wE5zT4yB6uN2oP9rX1',
  privateKey: 'qW3tY7uH9nL1xG4sD8fJ0hM2qC4vA6wE5z'
};

webpush.setVapidDetails(
  'mailto:support@akwaconnect.ng',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Store push subscriptions
const pushSubscriptions = new Map();

// WebSocket setup
const wss = new WebSocket.Server({ noServer: true });

// Helper function
const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now - then;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    
    return then.toLocaleDateString();
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'akwa-connect-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
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
            return res.status(401).json({ error: 'Access token required' });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'akwa-connect-secret-key');
        
        // Get user from database
        const { data: user, error } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', decoded.userId)
            .single();
        
        if (error || !user || !user.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        req.userId = decoded.userId;
        next();
        
    } catch (error) {
        console.error('Admin middleware error:', error);
        return res.status(403).json({ error: 'Invalid token or admin access required' });
    }
};

// WebSocket connection handler
const handleWebSocketConnection = (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    
    // Store user connection
    ws.userId = userId;
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
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
                        user_name: data.user_name
                    });
                    break;
                    
                case 'read_receipt':
                    broadcastToUser(data.user_id, {
                        type: 'read_receipt',
                        conversation_id: data.conversation_id
                    });
                    break;
            }
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });
    
    ws.on('close', () => {
        // Clean up
    });
};

// Broadcast to specific user
const broadcastToUser = (userId, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.userId === userId) {
            client.send(JSON.stringify(data));
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
        
        // Check if user exists
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('email')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create auth user (in production, use Supabase Auth)
        const { data: newUser, error: userError } = await supabase
            .from('profiles')
            .insert([{
                email,
                password_hash: hashedPassword,
                ...profile,
                created_at: new Date().toISOString(),
                last_active: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (userError) throw userError;
        
        // Create JWT token
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email },
            process.env.JWT_SECRET || 'akwa-connect-secret-key',
            { expiresIn: '30d' }
        );
        
        // Remove password hash from response
        delete newUser.password_hash;
        
        res.json({
            success: true,
            user: newUser,
            token
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Get user
        const { data: user, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password (in production, use Supabase Auth)
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'akwa-connect-secret-key',
            { expiresIn: '30d' }
        );
        
        // Update last active
        await supabase
            .from('profiles')
            .update({ last_active: new Date().toISOString() })
            .eq('id', user.id);
        
        // Remove password hash from response
        delete user.password_hash;
        
        res.json({
            success: true,
            user,
            token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Protected route example
app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Protected data', user: req.user });
});

// Profile endpoints
app.get('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/profile/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get match count
        const { count: matchCount } = await supabase
            .from('matches')
            .select('*', { count: 'exact' })
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
        
        // Get message count
        const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact' })
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
        
        // Calculate acceptance rate
        const { count: totalLikes } = await supabase
            .from('interactions')
            .select('*', { count: 'exact' })
            .eq('target_id', userId)
            .eq('action', 'like');
        
        const { count: userLikes } = await supabase
            .from('interactions')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .eq('action', 'like');
        
        const acceptanceRate = totalLikes > 0 
            ? Math.round((userLikes / totalLikes) * 100) 
            : 0;
        
        res.json({
            matches: matchCount || 0,
            messages: messageCount || 0,
            acceptance_rate: `${acceptanceRate}%`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/profile/:userId/activity', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Recent matches (last 7 days)
        const { data: recentMatches } = await supabase
            .from('matches')
            .select(`
                *,
                other_user:profiles!matches_user2_id_fkey(full_name, lga)
            `)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .gte('matched_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('matched_at', { ascending: false })
            .limit(5);
        
        // Profile views (simulated - you'd need a views table)
        const recentViews = [];
        
        res.json({
            recent_matches: recentMatches?.map(match => ({
                name: match.other_user?.full_name || 'Anonymous',
                lga: match.other_user?.lga,
                time_ago: formatTimeAgo(match.matched_at)
            })) || [],
            recent_views: recentViews
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Delete from profiles table
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Matches endpoint
app.get('/api/matches/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { manual = false, filters = {} } = req.query;
        
        // Get current user
        const { data: currentUser, error: userError } = await supabase
            .from(USERS_TABLE)
            .select('*')
            .eq('id', userId)
            .single();
        
        if (userError) throw userError;
        
        // Get all potential matches
        let query = supabase
            .from(USERS_TABLE)
            .select('*')
            .neq('id', userId)
            .gte('age', currentUser.minAgePreference || 25)
            .lte('age', currentUser.maxAgePreference || 40);
        
        if (currentUser.genderPreference) {
            query = query.in('gender', currentUser.genderPreference);
        }
        
        const { data: potentialMatches, error: matchesError } = await query;
        
        if (matchesError) throw matchesError;
        
        // Initialize matcher
        const matcher = new AkwaMatcher();
        
        if (manual && Object.keys(filters).length > 0) {
            // Manual matching with filters
            const manualMatches = matcher.findManualMatches(
                userId,
                [currentUser, ...potentialMatches],
                filters
            );
            res.json({ matches: manualMatches, type: 'manual' });
        } else {
            // Algorithmic matching
            const scoredMatches = potentialMatches.map(match => {
                const compatibility = matcher.calculateCompatibility(currentUser, match);
                return {
                    user: match,
                    score: compatibility.totalScore,
                    reasons: compatibility.reasons,
                    compatible: compatibility.compatible
                };
            });
            
            // Filter and sort
            const filteredMatches = scoredMatches
                .filter(m => m.compatible)
                .sort((a, b) => b.score - a.score);
            
            res.json({ matches: filteredMatches, type: 'algorithmic' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/swipe', async (req, res) => {
    try {
        const { userId, targetId, action } = req.body;
        
        // Record interaction
        const { error } = await supabase
            .from('interactions')
            .insert([{
                user_id: userId,
                target_id: targetId,
                action,
                timestamp: new Date()
            }]);
        
        if (error) throw error;
        
        // Check for match
        if (action === 'like') {
            const { data: reciprocal } = await supabase
                .from('interactions')
                .select('*')
                .eq('user_id', targetId)
                .eq('target_id', userId)
                .eq('action', 'like')
                .single();
            
            if (reciprocal) {
                // It's a match!
                await supabase
                    .from('matches')
                    .insert([{
                        user1_id: userId,
                        user2_id: targetId,
                        matched_at: new Date()
                    }]);
                
                return res.json({ match: true });
            }
        }
        
        res.json({ match: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Conversations endpoints
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get matches that have conversations
        const { data: matches } = await supabase
            .from('matches')
            .select(`
                *,
                other_user:profiles!matches_user2_id_fkey(*)
            `)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
        
        // Get last messages for each match
        const conversations = await Promise.all(
            (matches || []).map(async (match) => {
                const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;
                
                const { data: lastMessage } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`sender_id.eq.${userId}.and.receiver_id.eq.${otherUserId},
                         sender_id.eq.${otherUserId}.and.receiver_id.eq.${userId}`)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .single();
                
                // Count unread messages
                const { count: unreadCount } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact' })
                    .eq('receiver_id', userId)
                    .eq('sender_id', otherUserId)
                    .eq('read', false);
                
                return {
                    id: match.id,
                    user: match.other_user,
                    last_message: lastMessage,
                    unread_count: unreadCount || 0,
                    matched_at: match.matched_at
                };
            })
        );
        
        // Sort by last message time
        conversations.sort((a, b) => 
            new Date(b.last_message?.timestamp || 0) - new Date(a.last_message?.timestamp || 0)
        );
        
        res.json({ conversations });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/conversations/:conversationId/messages', async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        // Get match to find user IDs
        const { data: match } = await supabase
            .from('matches')
            .select('*')
            .eq('id', conversationId)
            .single();
        
        if (!match) {
            return res.json({ messages: [] });
        }
        
        // Get messages between these users
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${match.user1_id}.and.receiver_id.eq.${match.user2_id},
                 sender_id.eq.${match.user2_id}.and.receiver_id.eq.${match.user1_id}`)
            .order('timestamp', { ascending: true });
        
        res.json({ messages: messages || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/conversations/:conversationId/read', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { user_id } = req.body;
        
        // Get match to find other user
        const { data: match } = await supabase
            .from('matches')
            .select('*')
            .eq('id', conversationId)
            .single();
        
        if (!match) {
            return res.json({ success: true });
        }
        
        const otherUserId = match.user1_id === user_id ? match.user2_id : match.user1_id;
        
        // Mark messages as read
        const { error } = await supabase
            .from('messages')
            .update({ read: true })
            .eq('sender_id', otherUserId)
            .eq('receiver_id', user_id)
            .eq('read', false);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const message = req.body;
        
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                ...message,
                read: false,
                timestamp: new Date().toISOString()
            }]);
        
        if (error) throw error;
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin endpoints
app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
        // Get total users
        const { count: totalUsers, error: countError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' });
        
        if (countError) throw countError;
        
        // Get male users
        const { count: maleUsers, error: maleError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .eq('gender', 'male');
        
        if (maleError) throw maleError;
        
        // Get female users
        const { count: femaleUsers, error: femaleError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .eq('gender', 'female');
        
        if (femaleError) throw femaleError;
        
        // Calculate age groups
        const { data: allUsers, error: usersError } = await supabase
            .from('profiles')
            .select('dob');
        
        if (usersError) throw usersError;
        
        let age18_25 = 0;
        let age25_35 = 0;
        let age35_50 = 0;
        
        allUsers.forEach(user => {
            if (!user.dob) return;
            
            const birthDate = new Date(user.dob);
            const age = new Date().getFullYear() - birthDate.getFullYear();
            
            if (age >= 18 && age <= 25) age18_25++;
            else if (age > 25 && age <= 35) age25_35++;
            else if (age > 35 && age <= 50) age35_50++;
        });
        
        // Get today's registrations
        const today = new Date().toISOString().split('T')[0];
        const { count: todayRegistrations } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`);
        
        // Get active users (last 7 days)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count: activeUsers } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .gte('last_active', weekAgo);
        
        res.json({
            total_users: totalUsers || 0,
            male_users: maleUsers || 0,
            female_users: femaleUsers || 0,
            age_18_25: age18_25,
            age_25_35: age25_35,
            age_35_50: age35_50,
            today_registrations: todayRegistrations || 0,
            active_users: activeUsers || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users/recent', isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        // Calculate ages and format data
        const formattedUsers = users.map(user => ({
            ...user,
            age: user.dob ? new Date().getFullYear() - new Date(user.dob).getFullYear() : null
        }));
        
        res.json(formattedUsers);
        
    } catch (error) {
        console.error('Recent users error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/analytics/growth', isAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        
        const dates = [];
        const counts = [];
        
        // Generate data for last N days
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const start = `${dateStr}T00:00:00`;
            const end = `${dateStr}T23:59:59`;
            
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact' })
                .gte('created_at', start)
                .lte('created_at', end);
            
            if (error) throw error;
            
            dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            counts.push(count || 0);
        }
        
        res.json({ dates, counts });
        
    } catch (error) {
        console.error('Growth analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const { data: users, error, count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({
            users,
            pagination: {
                page,
                limit,
                total: count,
                total_pages: Math.ceil(count / limit)
            }
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/users/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Don't allow self-deletion
        if (userId === req.userId) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/users/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, user: data[0] });
        
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Push notification endpoints
app.post('/api/push-subscription', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    
    // Store in database (or in-memory for demo)
    pushSubscriptions.set(userId, subscription);
    
    // Also save to Supabase for persistence
    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        push_subscription: subscription,
        updated_at: new Date().toISOString()
      });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/send-notification', async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;
    
    // Get subscription from database
    const { data: settings } = await supabase
      .from('user_settings')
      .select('push_subscription')
      .eq('user_id', userId)
      .single();
    
    if (!settings?.push_subscription) {
      return res.status(404).json({ error: 'No push subscription found' });
    }
    
    const subscription = JSON.parse(settings.push_subscription);
    
    const payload = JSON.stringify({
      title: title || 'Akwa-Connect',
      body: body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      data: data || {}
    });
    
    await webpush.sendNotification(subscription, payload);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Push notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notify-match', async (req, res) => {
  try {
    const { userId, matchUserId, matchName } = req.body;
    
    // Get both users' push subscriptions
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('push_subscription')
      .in('user_id', [userId, matchUserId]);
    
    // Send notifications to both users
    const notifications = userSettings
      .filter(settings => settings.push_subscription)
      .map(settings => {
        const subscription = JSON.parse(settings.push_subscription);
        const payload = JSON.stringify({
          title: '🎉 It\'s a Match!',
          body: `You and ${matchName} have liked each other!`,
          icon: '/icons/icon-192x192.png',
          data: {
            url: `/messages.html?matchId=${matchUserId}`,
            matchId: matchUserId
          }
        });
        
        return webpush.sendNotification(subscription, payload);
      });
    
    await Promise.allSettled(notifications);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Match notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Upgrade HTTP server to handle WebSocket
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});


