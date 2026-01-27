// admin-dashboard.js - Dashboard Specific Functionality
class AdminDashboard {
    constructor() {
        this.charts = {};
        this.stats = {};
    }

    /**
     * Initialize dashboard
     */
    async init() {
        try {
            // Initialize core
            await adminCore.init();
            
            // Load dashboard specific data
            await this.loadDashboard();
            
            // Set up dashboard event listeners
            this.setupDashboardListeners();
            
        } catch (error) {
            console.error('Dashboard initialization error:', error);
        }
    }

    /**
     * Load dashboard data
     */
    async loadDashboard() {
        try {
            adminCore.showLoading();
            
            // Load stats and recent users in parallel
            const [stats, recentUsers, growthData] = await Promise.all([
                this.fetchStats(),
                this.fetchRecentUsers(),
                this.fetchGrowthData()
            ]);
            
            // Update UI with loaded data
            this.updateStatsCards(stats);
            this.updateRecentUsersTable(recentUsers);
            this.renderCharts(stats, growthData);
            
            adminCore.hideLoading();
            
        } catch (error) {
            console.error('Load dashboard error:', error);
            adminCore.showToast('Failed to load dashboard data', 'error');
            adminCore.hideLoading();
        }
    }

    /**
     * Fetch platform statistics
     */
    async fetchStats() {
        try {
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/stats`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch stats');
            
            const data = await response.json();
            this.stats = data;
            return data;
            
        } catch (error) {
            console.error('Fetch stats error:', error);
            return this.getDefaultStats();
        }
    }

    /**
     * Fetch recent users
     */
    async fetchRecentUsers() {
        try {
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/users/recent?limit=10`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch recent users');
            
            return await response.json();
            
        } catch (error) {
            console.error('Fetch recent users error:', error);
            return [];
        }
    }

    /**
     * Fetch growth data for charts
     */
    async fetchGrowthData() {
        try {
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/analytics/growth?days=30`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch growth data');
            
            return await response.json();
            
        } catch (error) {
            console.error('Fetch growth data error:', error);
            return this.getMockGrowthData();
        }
    }

    /**
     * Update stats cards
     */
    updateStatsCards(stats) {
        const statCards = [
            { 
                id: 'total', 
                value: stats.total_users || 0, 
                label: 'Total Users', 
                icon: 'people', 
                color: '#3b82f6' 
            },
            { 
                id: 'male', 
                value: stats.male_users || 0, 
                label: 'Male Users', 
                icon: 'man', 
                color: '#10b981' 
            },
            { 
                id: 'female', 
                value: stats.female_users || 0, 
                label: 'Female Users', 
                icon: 'woman', 
                color: '#f59e0b' 
            },
            { 
                id: 'age18_25', 
                value: stats.age_18_25 || 0, 
                label: 'Age 18-25', 
                icon: 'cake', 
                color: '#8b5cf6' 
            },
            { 
                id: 'age25_35', 
                value: stats.age_25_35 || 0, 
                label: 'Age 25-35', 
                icon: 'person', 
                color: '#ec4899' 
            },
            { 
                id: 'age35_50', 
                value: stats.age_35_50 || 0, 
                label: 'Age 35-50', 
                icon: 'elderly', 
                color: '#22c55e' 
            }
        ];

        $('#statsGrid').html(
            statCards.map(stat => this.createStatCardHTML(stat)).join('')
        );
    }

    /**
     * Create stat card HTML
     */
    createStatCardHTML(stat) {
        const trend = adminCore.getTrendData(stat.id, stat.value);
        
        return `
            <div class="stat-card">
                <div class="stat-icon" style="background: ${adminCore.lightenColor(stat.color, 0.9)}; color: ${stat.color};">
                    <i class="material-icons">${stat.icon}</i>
                </div>
                <div class="stat-value">${stat.value.toLocaleString()}</div>
                <div class="stat-label">${stat.label}</div>
                <div class="stat-trend ${trend.class}">
                    <i class="material-icons">${trend.icon}</i>
                    <span>${trend.percent}% this month</span>
                </div>
            </div>
        `;
    }

    /**
     * Update recent users table
     */
    updateRecentUsersTable(users) {
        const $tableBody = $('#recentUsersTable');
        
        if (!users || users.length === 0) {
            $tableBody.html(this.getEmptyTableHTML('No users found'));
            return;
        }
        
        $tableBody.html(
            users.map(user => this.createUserTableRow(user)).join('')
        );
    }

    /**
     * Create user table row HTML
     */
    createUserTableRow(user) {
        const age = adminCore.calculateAge(user.dob);
        const joinedDate = adminCore.formatDate(user.created_at);
        const statusClass = user.is_active ? 'status-active' : 'status-inactive';
        const statusText = user.is_active ? 'Active' : 'Inactive';
        const avatarColor = adminCore.getColorFromName(user.full_name);
        const avatarInitial = user.full_name?.charAt(0) || 'U';
        
        return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar-small" style="background-color: ${avatarColor}">
                            ${avatarInitial}
                        </div>
                        <div>
                            <strong>${user.full_name || 'Anonymous'}</strong><br>
                            <small class="user-id">ID: ${user.id.substring(0, 8)}</small>
                        </div>
                    </div>
                </td>
                <td>${user.email || 'N/A'}</td>
                <td><span class="status-badge status-active">${user.lga || 'Unknown'}</span></td>
                <td>${age || 'N/A'}</td>
                <td>${user.gender || 'N/A'}</td>
                <td>${joinedDate}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
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
        `;
    }

    /**
     * Get empty table HTML
     */
    getEmptyTableHTML(message) {
        return `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="material-icons">group_off</i>
                    <p>${message}</p>
                </td>
            </tr>
        `;
    }

    /**
     * Render charts
     */
    renderCharts(stats, growthData) {
        this.renderUserGrowthChart(growthData);
        this.renderGenderChart(stats);
        this.renderAgeDistributionChart(stats);
    }

    /**
     * Render user growth chart
     */
    renderUserGrowthChart(growthData) {
        const ctx = document.getElementById('userGrowthChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.charts.userGrowth) {
            this.charts.userGrowth.destroy();
        }
        
        const labels = growthData.dates || this.generateDateLabels(30);
        const data = growthData.counts || this.generateRandomData(30);
        
        this.charts.userGrowth = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'New Users',
                    data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: this.getChartOptions('User Growth Over Time')
        });
    }

    /**
     * Render gender distribution chart
     */
    renderGenderChart(stats) {
        const ctx = document.getElementById('genderChart');
        if (!ctx) return;
        
        if (this.charts.gender) {
            this.charts.gender.destroy();
        }
        
        const male = stats.male_users || 0;
        const female = stats.female_users || 0;
        const other = (stats.total_users || 0) - male - female;
        
        this.charts.gender = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Male', 'Female', 'Other'],
                datasets: [{
                    data: [male, female, other],
                    backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6'],
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    /**
     * Render age distribution chart
     */
    renderAgeDistributionChart(stats) {
        const ctx = document.getElementById('ageDistributionChart');
        if (!ctx) return;
        
        if (this.charts.ageDistribution) {
            this.charts.ageDistribution.destroy();
        }
        
        const ageGroups = [
            stats.age_18_25 || 0,
            stats.age_25_35 || 0,
            stats.age_35_50 || 0,
            (stats.total_users || 0) - 
            (stats.age_18_25 || 0) - 
            (stats.age_25_35 || 0) - 
            (stats.age_35_50 || 0)
        ];
        
        this.charts.ageDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['18-25', '25-35', '35-50', '50+'],
                datasets: [{
                    label: 'Users',
                    data: ageGroups,
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
            options: this.getChartOptions('Age Distribution')
        });
    }

    /**
     * Get chart options
     */
    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false,
                    text: title
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                }
            }
        };
    }

    /**
     * Generate date labels
     */
    generateDateLabels(days) {
        const labels = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            }));
        }
        
        return labels;
    }

    /**
     * Generate random data
     */
    generateRandomData(count) {
        const data = [];
        let lastValue = 50;
        
        for (let i = 0; i < count; i++) {
            const change = Math.floor(Math.random() * 20) - 5;
            lastValue = Math.max(0, lastValue + change);
            data.push(lastValue);
        }
        
        return data;
    }

    /**
     * Get default stats
     */
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

    /**
     * Get mock growth data
     */
    getMockGrowthData() {
        return {
            dates: this.generateDateLabels(30),
            counts: this.generateRandomData(30)
        };
    }

    /**
     * Setup dashboard event listeners
     */
    setupDashboardListeners() {
        // Refresh button
        $('#refreshBtn').off('click').on('click', () => {
            this.loadDashboard();
            adminCore.showToast('Dashboard data refreshed', 'success');
        });
    }

    /**
     * View user details
     */
    viewUser(userId) {
        adminCore.showToast(`View user ${userId} - Feature coming soon`, 'info');
    }

    /**
     * Edit user
     */
    editUser(userId) {
        adminCore.showToast(`Edit user ${userId} - Feature coming soon`, 'info');
    }

    /**
     * Delete user
     */
    deleteUser(userId) {
        if (confirm('Are you sure you want to delete this user?')) {
            fetch(`${adminCore.apiBaseUrl}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: adminCore.getAuthHeaders()
            })
            .then(response => {
                if (response.ok) {
                    adminCore.showToast('User deleted successfully', 'success');
                    this.loadDashboard();
                } else {
                    throw new Error('Failed to delete user');
                }
            })
            .catch(error => {
                console.error('Delete error:', error);
                adminCore.showToast('Failed to delete user', 'error');
            });
        }
    }
}

// Initialize AdminDashboard
window.adminDashboard = new AdminDashboard();