// admin-users.js - Users Management Functionality
class AdminUsers {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.currentFilters = {};
        this.selectedUsers = new Set();
    }

    /**
     * Initialize users management
     */
    async init() {
        try {
            // Initialize core
            await adminCore.init();
            
            // Initialize users management
            await this.initUsersManagement();
            
            // Set up event listeners
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Users management initialization error:', error);
        }
    }

    /**
     * Initialize users management
     */
    async initUsersManagement() {
        // Load LGAs for filter dropdown
        await this.loadLGAs();
        
        // Load initial users
        await this.loadUsers();
    }

    /**
     * Load LGAs for filter dropdown
     */
    async loadLGAs() {
        try {
            const response = await fetch(`${adminCore.apiBaseUrl}/lgas`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (response.ok) {
                const lgas = await response.json();
                this.populateLGAFilter(lgas);
            }
        } catch (error) {
            console.error('Load LGAs error:', error);
            // Use default LGAs
            this.populateLGAFilter(['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Etinan']);
        }
    }

    /**
     * Populate LGA filter dropdown
     */
    populateLGAFilter(lgas) {
        const $lgaFilter = $('#lgaFilter');
        $lgaFilter.html('<option value="">All LGAs</option>');
        
        lgas.forEach(lga => {
            $lgaFilter.append(`<option value="${lga.toLowerCase()}">${lga}</option>`);
        });
    }

    /**
     * Load users with pagination
     */
    async loadUsers(page = 1) {
        try {
            adminCore.showLoading();
            
            this.currentPage = page;
            
            // Build query parameters
            const params = new URLSearchParams({
                page,
                limit: this.itemsPerPage,
                ...this.currentFilters
            });
            
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/users?${params}`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to load users');
            
            const data = await response.json();
            
            // Update UI
            this.updateUsersTable(data.users || []);
            this.updatePagination(data.pagination);
            this.updateUserCount(data.pagination?.total || 0);
            
            adminCore.hideLoading();
            
        } catch (error) {
            console.error('Load users error:', error);
            adminCore.showToast('Failed to load users', 'error');
            adminCore.hideLoading();
        }
    }

    /**
     * Update users table
     */
    updateUsersTable(users) {
        const $tableBody = $('#usersTable');
        
        if (!users || users.length === 0) {
            $tableBody.html(this.getEmptyTableHTML('No users found'));
            return;
        }
        
        $tableBody.html(
            users.map(user => this.createUserRowHTML(user)).join('')
        );
        
        // Reset select all checkbox
        $('#selectAll').prop('checked', false);
        this.selectedUsers.clear();
    }

    /**
     * Create user row HTML
     */
    createUserRowHTML(user) {
        const age = adminCore.calculateAge(user.dob);
        const joinedDate = adminCore.formatDate(user.created_at);
        const statusClass = user.is_active ? 'status-active' : 'status-inactive';
        const statusText = user.is_active ? 'Active' : 'Inactive';
        const avatarColor = adminCore.getColorFromName(user.full_name);
        const avatarInitial = user.full_name?.charAt(0) || 'U';
        const userId = user.id;
        
        return `
            <tr>
                <td>
                    <label>
                        <input type="checkbox" class="user-checkbox" data-user-id="${userId}">
                        <span></span>
                    </label>
                </td>
                <td>
                    <div class="user-info">
                        <div class="user-avatar-small" style="background-color: ${avatarColor}">
                            ${avatarInitial}
                        </div>
                        <div>
                            <strong>${user.full_name || 'Anonymous'}</strong><br>
                            <small class="user-id">ID: ${userId.substring(0, 8)}</small>
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
                        <button class="btn-icon btn-view" onclick="adminUsers.viewUserDetail('${userId}')">
                            <i class="material-icons">visibility</i>
                        </button>
                        <button class="btn-icon btn-edit" onclick="adminUsers.editUser('${userId}')">
                            <i class="material-icons">edit</i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="adminUsers.confirmDeleteUser('${userId}')">
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
                <td colspan="9" class="empty-state">
                    <i class="material-icons">group_off</i>
                    <p>${message}</p>
                </td>
            </tr>
        `;
    }

    /**
     * Update pagination
     */
    updatePagination(pagination) {
        const $pagination = $('#pagination');
        
        if (!pagination || pagination.total_pages <= 1) {
            $pagination.html('');
            return;
        }
        
        let html = '';
        const { current_page, total_pages } = pagination;
        
        // Previous button
        if (current_page > 1) {
            html += `
                <button class="pagination-btn" onclick="adminUsers.loadUsers(${current_page - 1})">
                    <i class="material-icons">chevron_left</i>
                </button>
            `;
        }
        
        // Page numbers
        const maxPages = 5;
        let startPage = Math.max(1, current_page - Math.floor(maxPages / 2));
        let endPage = Math.min(total_pages, startPage + maxPages - 1);
        
        if (endPage - startPage + 1 < maxPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === current_page ? 'active' : '';
            html += `
                <button class="pagination-btn ${activeClass}" onclick="adminUsers.loadUsers(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        if (current_page < total_pages) {
            html += `
                <button class="pagination-btn" onclick="adminUsers.loadUsers(${current_page + 1})">
                    <i class="material-icons">chevron_right</i>
                </button>
            `;
        }
        
        $pagination.html(html);
    }

    /**
     * Update user count
     */
    updateUserCount(count) {
        $('#userCount').text(count.toLocaleString());
    }

    /**
     * Apply filters
     */
    applyFilters() {
        this.currentFilters = {
            search: $('#searchInput').val().trim(),
            gender: $('#genderFilter').val(),
            lga: $('#lgaFilter').val(),
            status: $('#statusFilter').val()
        };
        
        // Remove empty filters
        Object.keys(this.currentFilters).forEach(key => {
            if (!this.currentFilters[key]) {
                delete this.currentFilters[key];
            }
        });
        
        this.loadUsers(1);
    }

    /**
     * Clear filters
     */
    clearFilters() {
        $('#searchInput').val('');
        $('#genderFilter').val('');
        $('#lgaFilter').val('');
        $('#statusFilter').val('');
        
        this.currentFilters = {};
        this.loadUsers(1);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Apply filters button
        $('#applyFiltersBtn').on('click', () => this.applyFilters());
        
        // Clear filters button
        $('#clearFiltersBtn').on('click', () => this.clearFilters());
        
        // Export users button
        $('#exportBtn').on('click', () => this.exportUsers());
        
        // Select all checkbox
        $('#selectAll').on('change', (e) => this.toggleSelectAll(e.target.checked));
        
        // User checkboxes (delegated event)
        $('#usersTable').on('change', '.user-checkbox', (e) => {
            this.toggleUserSelection(e.target);
        });
        
        // Search input with debounce
        let searchTimeout;
        $('#searchInput').on('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.applyFilters(), 500);
        });
        
        // Filter changes
        $('#genderFilter, #lgaFilter, #statusFilter').on('change', () => {
            this.applyFilters();
        });
        
        // Initialize modals
        this.initModals();
    }

    /**
     * Initialize modals
     */
    initModals() {
        // User detail modal
        this.userDetailModal = M.Modal.init($('#userDetailModal')[0]);
        
        // Delete confirmation modal
        this.deleteConfirmModal = M.Modal.init($('#deleteConfirmModal')[0]);
        
        // Confirm delete button
        $('#confirmDeleteBtn').on('click', () => {
            this.deleteSelectedUser();
        });
    }

    /**
     * Toggle select all users
     */
    toggleSelectAll(checked) {
        $('.user-checkbox').prop('checked', checked);
        
        if (checked) {
            $('.user-checkbox').each((_, checkbox) => {
                const userId = $(checkbox).data('user-id');
                this.selectedUsers.add(userId);
            });
        } else {
            this.selectedUsers.clear();
        }
    }

    /**
     * Toggle user selection
     */
    toggleUserSelection(checkbox) {
        const userId = $(checkbox).data('user-id');
        
        if (checkbox.checked) {
            this.selectedUsers.add(userId);
        } else {
            this.selectedUsers.delete(userId);
            $('#selectAll').prop('checked', false);
        }
    }

    /**
     * View user details
     */
    async viewUserDetail(userId) {
        try {
            adminCore.showLoading();
            
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/users/${userId}`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to load user details');
            
            const user = await response.json();
            
            // Format user details for modal
            const content = this.createUserDetailContent(user);
            $('#userDetailContent').html(content);
            
            // Open modal
            this.userDetailModal.open();
            
            adminCore.hideLoading();
            
        } catch (error) {
            console.error('View user detail error:', error);
            adminCore.showToast('Failed to load user details', 'error');
            adminCore.hideLoading();
        }
    }

    /**
     * Create user detail content
     */
    createUserDetailContent(user) {
        const age = adminCore.calculateAge(user.dob);
        const dobFormatted = user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A';
        const joinedDate = adminCore.formatDate(user.created_at);
        const lastActive = adminCore.formatDate(user.last_active);
        const statusClass = user.is_active ? 'status-active' : 'status-inactive';
        const statusText = user.is_active ? 'Active' : 'Inactive';
        const avatarColor = adminCore.getColorFromName(user.full_name);
        const avatarInitial = user.full_name?.charAt(0) || 'U';
        
        return `
            <div class="row">
                <div class="col s12 m4">
                    <div class="user-avatar-large center">
                        <div class="avatar-circle" style="background-color: ${avatarColor}">
                            ${avatarInitial}
                        </div>
                        <h5>${user.full_name || 'Anonymous'}</h5>
                        <p class="user-email">${user.email || 'N/A'}</p>
                    </div>
                </div>
                <div class="col s12 m8">
                    <div class="user-details">
                        <table class="striped">
                            <tr>
                                <td><strong>User ID:</strong></td>
                                <td>${user.id}</td>
                            </tr>
                            <tr>
                                <td><strong>Gender:</strong></td>
                                <td>${user.gender || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td><strong>Date of Birth:</strong></td>
                                <td>${dobFormatted} (Age: ${age || 'N/A'})</td>
                            </tr>
                            <tr>
                                <td><strong>Location:</strong></td>
                                <td>${user.city || 'N/A'}, ${user.lga || 'N/A'} LGA</td>
                            </tr>
                            <tr>
                                <td><strong>Relationship Goal:</strong></td>
                                <td>${user.relationship_goal || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td><strong>Hobbies:</strong></td>
                                <td>${user.hobbies?.join(', ') || 'None'}</td>
                            </tr>
                            <tr>
                                <td><strong>Joined:</strong></td>
                                <td>${joinedDate}</td>
                            </tr>
                            <tr>
                                <td><strong>Last Active:</strong></td>
                                <td>${lastActive}</td>
                            </tr>
                            <tr>
                                <td><strong>Status:</strong></td>
                                <td><span class="status-badge ${statusClass}">
                                    ${statusText}
                                </span></td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col s12">
                    <h5>Bio</h5>
                    <div class="user-bio">${user.bio || 'No bio provided.'}</div>
                </div>
            </div>
            <div class="row">
                <div class="col s12">
                    <h5>Preferences</h5>
                    <div class="user-preferences">${user.preferences || 'No preferences specified.'}</div>
                </div>
            </div>
        `;
    }

    /**
     * Edit user
     */
    editUser(userId) {
        adminCore.showToast(`Edit user ${userId} - Feature coming soon`, 'info');
    }

    /**
     * Confirm delete user
     */
    confirmDeleteUser(userId) {
        this.userToDelete = userId;
        this.deleteConfirmModal.open();
    }

    /**
     * Delete selected user
     */
    async deleteSelectedUser() {
        if (!this.userToDelete) return;
        
        try {
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/users/${this.userToDelete}`, {
                method: 'DELETE',
                headers: adminCore.getAuthHeaders()
            });
            
            if (response.ok) {
                adminCore.showToast('User deleted successfully', 'success');
                this.deleteConfirmModal.close();
                this.loadUsers(this.currentPage);
            } else {
                throw new Error('Failed to delete user');
            }
            
        } catch (error) {
            console.error('Delete user error:', error);
            adminCore.showToast('Failed to delete user', 'error');
        }
    }

    /**
     * Export users
     */
    exportUsers() {
        adminCore.showToast('Export feature coming soon', 'info');
        // Implement CSV/Excel export functionality here
    }
}

// Initialize AdminUsers
window.adminUsers = new AdminUsers();