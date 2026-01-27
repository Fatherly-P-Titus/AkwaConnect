// admin-core.js - Core Admin Functionality
class AdminCore {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api';
        this.currentUser = null;
        this.charts = {};
        this.modals = {};
        this.currentPage = 'dashboard';
    }

    /**
     * Initialize admin system
     */
    async init() {
        try {
            // Check authentication
            await this.checkAuth();
            
            // Load admin data
            await this.loadAdminData();
            
            // Initialize UI components
            this.initUI();
            
            // Initialize sidebar
            await this.initSidebar();
            
            // Set active nav item
            this.setActiveNav();
            
        } catch (error) {
            console.error('Admin initialization error:', error);
            this.showToast('Failed to initialize admin panel', 'error');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        }
    }

    /**
     * Check admin authentication
     */
    async checkAuth() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const token = localStorage.getItem('authToken');
        
        if (!currentUser.id || !token || !currentUser.is_admin) {
            this.showToast('Access denied. Admins only.', 'error');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
            throw new Error('Not authorized');
        }
        
        this.currentUser = currentUser;
        this.authToken = token;
        
        // Update admin info in UI
        this.updateAdminInfo();
        
        return true;
    }

    /**
     * Update admin information in sidebar
     */
    updateAdminInfo() {
        const adminName = this.currentUser.full_name || 'Admin';
        const adminInitial = adminName.charAt(0).toUpperCase();
        
        $('#adminName').text(adminName);
        $('#adminAvatar').text(adminInitial);
        
        // Update current date
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        $('#currentDate').text(now.toLocaleDateString('en-US', options));
    }

    /**
     * Load admin dashboard data
     */
    async loadAdminData() {
        try {
            this.showLoading();
            
            if (this.currentPage === 'dashboard') {
                await this.loadDashboardData();
            } else if (this.currentPage === 'users') {
                await this.loadUsersData();
            }
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Load admin data error:', error);
            this.showToast('Failed to load admin data', 'error');
            this.hideLoading();
        }
    }

    /**
     * Initialize UI components
     */
    initUI() {
        // Initialize Materialize components
        this.initMaterialize();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Initialize Materialize components
     */
    initMaterialize() {
        // Initialize modals
        $('.modal').modal();
        
        // Initialize dropdowns if any
        $('.dropdown-trigger').dropdown();
        
        // Initialize tooltips
        $('.tooltipped').tooltip();
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Logout button
        $('#logoutBtn').on('click', (e) => {
            e.preventDefault();
            this.logout();
        });
        
        // Refresh button
        $('#refreshBtn').on('click', () => {
            this.loadAdminData();
        });
    }

    /**
     * Initialize sidebar
     */
    async initSidebar() {
        const sidebarHTML = `
            <div class="admin-sidebar">
                <div class="admin-sidebar-header">
                    <h3>
                        <div class="admin-logo-icon">
                            <i class="material-icons">admin_panel_settings</i>
                        </div>
                        <span class="nav-text">Akwa-Connect Admin</span>
                    </h3>
                </div>
                
                <nav class="admin-nav">
                    <a href="index.html" class="admin-nav-item" data-page="dashboard">
                        <i class="material-icons">dashboard</i>
                        <span class="nav-text">Dashboard</span>
                    </a>
                    <a href="users.html" class="admin-nav-item" data-page="users">
                        <i class="material-icons">people</i>
                        <span class="nav-text">Users</span>
                    </a>
                    <a href="reports.html" class="admin-nav-item" data-page="reports">
                        <i class="material-icons">analytics</i>
                        <span class="nav-text">Analytics</span>
                    </a>
                    <a href="../matches.html" class="admin-nav-item">
                        <i class="material-icons">favorite</i>
                        <span class="nav-text">Matches</span>
                    </a>
                    <a href="../messages.html" class="admin-nav-item">
                        <i class="material-icons">message</i>
                        <span class="nav-text">Messages</span>
                    </a>
                    <a href="#" class="admin-nav-item" id="logoutBtn">
                        <i class="material-icons">logout</i>
                        <span class="nav-text">Logout</span>
                    </a>
                </nav>
                
                <div class="admin-user-info">
                    <div style="display: flex; align-items: center;">
                        <div class="admin-user-avatar" id="adminAvatar">A</div>
                        <div>
                            <div class="user-name" id="adminName">Loading...</div>
                            <small style="opacity: 0.7; font-size: 0.8em;">Administrator</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('#admin-sidebar-container').html(sidebarHTML);
    }

    /**
     * Set active navigation item
     */
    setActiveNav() {
        const currentPage = window.location.pathname.split('/').pop();
        
        $('.admin-nav-item').removeClass('active');
        
        if (currentPage === 'index.html' || currentPage === '') {
            $('[data-page="dashboard"]').addClass('active');
            this.currentPage = 'dashboard';
        } else if (currentPage === 'users.html') {
            $('[data-page="users"]').addClass('active');
            this.currentPage = 'users';
        } else if (currentPage === 'reports.html') {
            $('[data-page="reports"]').addClass('active');
            this.currentPage = 'reports';
        }
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        // This will be implemented in admin-dashboard.js
        console.log('Loading dashboard data...');
    }

    /**
     * Load users data
     */
    async loadUsersData() {
        // This will be implemented in admin-users.js
        console.log('Loading users data...');
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        $('body').append(`
            <div class="loading-overlay">
                <div class="loading-spinner"></div>
            </div>
        `);
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        $('.loading-overlay').remove();
    }

    /**
     * Show toast/notification
     */
    showToast(message, type = 'success') {
        // Remove existing toasts
        $('.toast').remove();
        
        const icon = type === 'error' ? 'error' : 
                    type === 'warning' ? 'warning' : 
                    type === 'info' ? 'info' : 'check_circle';
        
        const toast = $(`
            <div class="toast ${type}">
                <i class="material-icons">${icon}</i>
                <span>${message}</span>
            </div>
        `);
        
        $('body').append(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.fadeOut(300, () => toast.remove());
        }, 3000);
    }

    /**
     * Get authentication headers
     */
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
        };
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Calculate age from date of birth
     */
    calculateAge(dob) {
        if (!dob) return null;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    /**
     * Get color from name for avatars
     */
    getColorFromName(name) {
        const colors = [
            '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', 
            '#ec4899', '#ef4444', '#14b8a6', '#f97316'
        ];
        
        if (!name) return colors[0];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Lighten color
     */
    lightenColor(color, factor) {
        const hex = color.replace('#', '');
        const num = parseInt(hex, 16);
        
        let r = (num >> 16) & 255;
        let g = (num >> 8) & 255;
        let b = num & 255;
        
        r = Math.round(r + (255 - r) * factor);
        g = Math.round(g + (255 - g) * factor);
        b = Math.round(b + (255 - b) * factor);
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Logout admin
     */
    logout() {
        localStorage.clear();
        this.showToast('Logged out successfully', 'info');
        
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1000);
    }

    /**
     * Get trend data
     */
    getTrendData(statId, currentValue) {
        const trends = {
            total: { icon: 'trending_up', class: 'trend-up', percent: 12 },
            male: { icon: 'trending_up', class: 'trend-up', percent: 8 },
            female: { icon: 'trending_up', class: 'trend-up', percent: 15 },
            age18_25: { icon: 'trending_up', class: 'trend-up', percent: 20 },
            age25_35: { icon: 'trending_up', class: 'trend-up', percent: 10 },
            age35_50: { icon: 'trending_up', class: 'trend-up', percent: 5 }
        };
        
        return trends[statId] || { icon: 'trending_up', class: 'trend-up', percent: 0 };
    }
}

// Initialize AdminCore globally
window.adminCore = new AdminCore();