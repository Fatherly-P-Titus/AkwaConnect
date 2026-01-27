// admin.js - Akwa-Connect Admin Dashboard

class AdminDashboard {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api';
        this.charts = {};
        this.stats = {};
    }

    // Load all dashboard data
    async loadDashboardData() {
        try {
            // Show loading state
            this.showLoading(true);
            
            // Load all data in parallel
            const [stats, recentUsers, growthData] = await Promise.all([
                this.fetchStats(),
                this.fetchRecentUsers(),
                this.fetchGrowthData()
            ]);
            
            // Update UI
            this.updateStatsCards(stats);
            this.updateRecentUsersTable(recentUsers);
            this.renderCharts(stats, growthData);
            
            // Hide loading
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showToast('Failed to load dashboard data', 'error');
            this.showLoading(false);
        }
    }

    // Fetch platform statistics
    async fetchStats() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/admin/stats`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch stats');
            
            const data = await response.json();
            this.stats = data;
            return data;
            
        } catch (error) {
            console.error('Stats fetch error:', error);
            return this.getDefaultStats();
        }
    }

    // Fetch recent users
    async fetchRecentUsers() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/admin/users/recent?limit=10`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch users');
            
            return await response.json();
            
        } catch (error) {
            console.error('Recent users fetch error:', error);
            return [];
        }
    }

    // Fetch growth data for charts
    async fetchGrowthData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/admin/analytics/growth?days=30`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch growth data');
            
            return await response.json();
            
        } catch (error) {
            console.error('Growth data fetch error:', error);
            return this.getMockGrowthData();
        }
    }

    // Update stats cards
    updateStatsCards(stats) {
        const statCards = [
            { id: 'total', value: stats.total_users || 0, label: 'Total Users', icon: 'people', color: '#3b82f6' },
            { id: 'male', value: stats.male_users || 0, label: 'Male Users', icon: 'man', color: '#10b981' },
            { id: 'female', value: stats.female_users || 0, label: 'Female Users', icon: 'woman', color: '#f59e0b' },
            { id: 'age18_25', value: stats.age_18_25 || 0, label: 'Age 18-25', icon: 'cake', color: '#8b5cf6' },
            { id: 'age25_35', value: stats.age_25_35 || 0, label: 'Age 25-35', icon: 'person', color: '#ec4899' },
            { id: 'age35_50', value: stats.age_35_50 || 0, label: 'Age 35-50', icon: 'elderly', color: '#22c55e' }
        ];

        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;

        statsGrid.innerHTML = statCards.map(stat => `
            <div class="stat-card">
                <div class="stat-icon" style="background: ${this.lightenColor(stat.color, 0.9)}; color: ${stat.color};">
                    <i class="material-icons">${stat.icon}</i>
                </div>
                <div class="stat-value">${stat.value.toLocaleString()}</div>
                <div class="stat-label">${stat.label}</div>
                <div class="stat-trend ${this.getTrendClass(stat.id)}">
                    <i class="material-icons">${this.getTrendIcon(stat.id)}</i>
                    <span>${this.getTrendPercentage(stat.id)}% this month</span>
                </div>
            </div>
        `).join('');
    }

    // Update recent users table
    updateRecentUsersTable(users) {
        const tableBody = document.getElementById('recentUsersTable');
        if (!tableBody) return;

        if (!users || users.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <i class="material-icons" style="font-size: 48px; color: #d1d5db;">group_off</i>
                        <p>No users found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="user-avatar-small" style="background-color: ${this.getColorFromName(user.full_name)}">
                            ${user.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <strong>${user.full_name || 'Anonymous'}</strong><br>
                            <small style="color: #6b7280;">ID: ${user.id.substring(0, 8)}</small>
                        </div>
                    </div>
                </td>
                <td>${user.email || 'N/A'}</td>
                <td><span class="status-badge status-active">${user.lga || 'Unknown'}</span></td>
                <td>${this.calculateAge(user.dob) || 'N/A'}</td>
                <td>${user.gender || 'N/A'}</td>
                <td>${this.formatDate(user.created_at)}</td>
                <td>
                    <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon btn-view" onclick="adminDashboard.viewUser('${user.id}')">
                            <i class="material-icons">visibility</i>
                        </button>
                        <button class="btn-icon btn-edit" onclick="adminDashboard.editUser('${user.id}')">
                            <i class="material-icons">edit</i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="adminDashboard.deleteUser('${user.id}')">
                            <i class="material-icons">delete</i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Render charts
    renderCharts(stats, growthData) {
        this.renderUserGrowthChart(growthData);
        this.renderGenderChart(stats);
        this.renderAgeDistributionChart(stats);
    }

    // User growth chart
    renderUserGrowthChart(growthData) {
        const ctx = document.getElementById('userGrowthChart');
        if (!ctx) return;

        if (this.charts.userGrowth) {
            this.charts.userGrowth.destroy();
        }

        const labels = growthData.dates || Array.from({length: 30}, (_, i) => `Day ${i + 1}`);
        const data = growthData.counts || Array.from({length: 30}, () => Math.floor(Math.random() * 50));

        this.charts.userGrowth = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'New Users',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                }
            }
        });
    }

    // Gender distribution chart
    renderGenderChart(stats) {
        const ctx = document.getElementById('genderChart');
        if (!ctx) return;

        if (this.charts.gender) {
            this.charts.gender.destroy();
        }

        this.charts.gender = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Male', 'Female', 'Other'],
                datasets: [{
                    data: [
                        stats.male_users || 0,
                        stats.female_users || 0,
                        (stats.total_users || 0) - (stats.male_users || 0) - (stats.female_users || 0)
                    ],
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b',
                        '#8b5cf6'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Age distribution chart
    renderAgeDistributionChart(stats) {
        const ctx = document.getElementById('ageDistributionChart');
        if (!ctx) return;

        if (this.charts.ageDistribution) {
            this.charts.ageDistribution.destroy();
        }

        this.charts.ageDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['18-25', '25-35', '35-50', '50+'],
                datasets: [{
                    label: 'Users',
                    data: [
                        stats.age_18_25 || 0,
                        stats.age_25_35 || 0,
                        stats.age_35_50 || 0,
                        (stats.total_users || 0) - 
                        (stats.age_18_25 || 0) - 
                        (stats.age_25_35 || 0) - 
                        (stats.age_35_50 || 0)
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.7)',
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(139, 92, 246, 0.7)',
                        'rgba(236, 72, 153, 0.7)'
                    ],
                    borderColor: [
                        '#10b981',
                        '#f59e0b',
                        '#8b5cf6',
                        '#ec4899'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Show/hide loading state
    showLoading(show) {
        const loadingElements = document.querySelectorAll('.loading-state');
        if (show) {
            document.body.style.opacity = '0.7';
            document.body.style.pointerEvents = 'none';
        } else {
            document.body.style.opacity = '1';
            document.body.style.pointerEvents = 'auto';
        }
    }

    // Get authentication headers
    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // Helper methods
    calculateAge(dob) {
        if (!dob) return null;
        const birthDate = new Date(dob);
        const diff = Date.now() - birthDate.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    getColorFromName(name) {
        const colors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#f97316'];
        if (!name) return colors[0];
        const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        return colors[Math.abs(hash) % colors.length];
    }

    lightenColor(color, factor) {
        const hex = color.replace('#', '');
        const num = parseInt(hex, 16);
        const r = Math.round(((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * factor);
        const g = Math.round(((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * factor);
        const b = Math.round((num & 255) + (255 - (num & 255)) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    }

    getTrendClass(statId) {
        const trends = {
            total: 'trend-up',
            male: 'trend-up',
            female: 'trend-up',
            age18_25: 'trend-up',
            age25_35: 'trend-up',
            age35_50: 'trend-up'
        };
        return trends[statId] || 'trend-up';
    }

    getTrendIcon(statId) {
        return this.getTrendClass(statId) === 'trend-up' ? 'trending_up' : 'trending_down';
    }

    getTrendPercentage(statId) {
        // Mock percentages - in production, calculate from real data
        const percentages = {
            total: 12,
            male: 8,
            female: 15,
            age18_25: 20,
            age25_35: 10,
            age35_50: 5
        };
        return percentages[statId] || 0;
    }

    // Default stats for fallback
    getDefaultStats() {
        return {
            total_users: 0,
            male_users: 0,
            female_users: 0,
            age_18_25: 0,
            age_25_35: 0,
            age_35_50: 0
        };
    }

    // Mock growth data for fallback
    getMockGrowthData() {
        const dates = [];
        const counts = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            counts.push(Math.floor(Math.random() * 50));
        }
        
        return { dates, counts };
    }

    // User actions
    viewUser(userId) {
        window.location.href = `user-detail.html?id=${userId}`;
    }

    editUser(userId) {
        showToast(`Edit user ${userId}`, 'info');
        // In production, open edit modal or redirect to edit page
    }

    deleteUser(userId) {
        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            fetch(`${this.apiBaseUrl}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            })
            .then(response => {
                if (response.ok) {
                    showToast('User deleted successfully', 'success');
                    this.loadDashboardData();
                } else {
                    throw new Error('Failed to delete user');
                }
            })
            .catch(error => {
                console.error('Delete error:', error);
                showToast('Failed to delete user', 'error');
            });
        }
    }
}

// Initialize admin dashboard
const adminDashboard = new AdminDashboard();

// Make available globally
window.adminDashboard = adminDashboard;

// Load dashboard data function (called from HTML)
function loadDashboardData() {
    adminDashboard.loadDashboardData();
}


