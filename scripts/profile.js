// profile.js - Profile page functionality (jQuery Version)
$(document).ready(function() {
    // Initialize Materialize components
    M.AutoInit();
    
    // Initialize profile manager
    const profileManager = new ProfileManager();
    
    // Check authentication
    if (!authManager.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    // Load profile data
    profileManager.loadProfileData();
    profileManager.loadProfileStats();
    profileManager.loadRecentActivity();
    
    // Initialize event listeners
    profileManager.initEventListeners();
    
    // Setup tab functionality
    profileManager.setupTabs();
});

// Profile Manager Class
class ProfileManager {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        this.profileData = {};
        this.apiBaseUrl = 'http://localhost:3000/api'; // Change to your Render URL
    }
    
    // Load profile data from API
    async loadProfileData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/profile/${this.currentUser.id}`, {
                headers: authManager.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to load profile');
            }
            
            this.profileData = await response.json();
            this.updateProfileUI();
            this.loadUserPreferences();
            
        } catch (error) {
            console.error('Error loading profile:', error);
            // Use localStorage data as fallback
            this.profileData = this.currentUser;
            this.updateProfileUI();
        }
    }
    
    // Load user preferences
    async loadUserPreferences() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/users/${this.currentUser.id}/preferences`, {
                headers: authManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const preferences = await response.json();
                this.updatePreferencesUI(preferences);
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }
    
    // Update profile UI
    updateProfileUI() {
        const data = this.profileData;
        
        // Update profile picture
        this.updateProfilePicture(data.profile_picture_url);
        
        // Update basic info
        $('#profileUsername').text(data.username || 'Anonymous');
        $('#profileEmail').text(data.email || '--');
        
        // Calculate and display age
        if (data.dob) {
            const age = this.calculateAge(data.dob);
            $('#profileAge').text(`${age} years`);
            $('#profileAgeDetail').text(`${age} years`);
        }
        
        // Update location
        $('#profileLocation').text(data.city || 'Akwa Ibom');
        $('#profileLGADetail').text(data.lga || '--');
        $('#profileCity').text(data.city || '--');
        $('#profileLGA').text(data.lga || '--');
        
        // Update gender
        const gender = data.gender ? data.gender.charAt(0).toUpperCase() + data.gender.slice(1) : '--';
        $('#profileGender').text(gender);
        
        // Update bio
        $('#profileBioShort').text(data.bio ? this.truncateText(data.bio, 100) : 'No bio yet');
        $('#profileBioFull').text(data.bio || 'No bio provided yet.');
        
        // Update hobbies
        this.updateHobbiesUI(data.hobbies || []);
        
        // Update disability info
        if (data.has_disability && data.disability_desc) {
            $('#disabilitySection').show();
            $('#disabilityInfo').text(data.disability_desc);
        }
        
        // Update member since date
        if (data.created_at) {
            const memberSince = new Date(data.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long'
            });
            $('#memberSince').text(memberSince);
        }
        
        // Update relationship goal
        this.updateRelationshipGoal(data.relationship_goal);
    }
    
    // Update profile picture
    updateProfilePicture(imageUrl) {
        const $img = $('#profilePictureImg');
        const $fallback = $('#avatarFallback');
        
        if (imageUrl) {
            $img.attr('src', imageUrl).show();
            $fallback.hide();
        } else {
            $img.hide();
            $fallback.show();
            
            // Generate colored avatar with initials
            const initials = (this.profileData.username || 'U').charAt(0).toUpperCase();
            $fallback.find('i').text(initials);
            $fallback.css('background-color', getColorFromName(this.profileData.username || 'User'));
        }
    }
    
    // Update hobbies UI
    updateHobbiesUI(hobbies) {
        const $container = $('#profileHobbies');
        
        if (hobbies.length > 0) {
            const hobbyIcons = {
                'Reading': 'book',
                'Travel': 'flight',
                'Sports': 'sports_soccer',
                'Music': 'music_note',
                'Cooking': 'restaurant',
                'Movies': 'movie',
                'Art': 'palette',
                'Dancing': 'music_video',
                'Fashion': 'style',
                'Photography': 'camera_alt',
                'Technology': 'computer',
                'Volunteering': 'volunteer_activism',
                'Gaming': 'videogame_asset'
            };
            
            $container.html(
                hobbies.map(hobby => `
                    <div class="hobby-chip">
                        <i class="material-icons">${hobbyIcons[hobby] || 'star'}</i>
                        ${hobby}
                    </div>
                `).join('')
            );
        } else {
            $container.html('<p class="grey-text">No hobbies added yet</p>');
        }
    }
    
    // Update relationship goal
    updateRelationshipGoal(goal) {
        const goalConfig = {
            'marriage': {
                title: 'Marriage',
                description: 'Looking for a life partner',
                icon: 'favorite'
            },
            'serious': {
                title: 'Serious Relationship',
                description: 'Committed long-term relationship',
                icon: 'favorite_border'
            },
            'dating': {
                title: 'Casual Dating',
                description: 'Getting to know people',
                icon: 'date_range'
            },
            'friendship': {
                title: 'Friendship',
                description: 'Making new friends',
                icon: 'group'
            },
            'single_parent': {
                title: 'Single Parent Support',
                description: 'Connecting with other single parents',
                icon: 'family_restroom'
            }
        };
        
        const config = goalConfig[goal] || goalConfig.serious;
        
        $('#goalTitle').text(config.title);
        $('#goalDescription').text(config.description);
        $('#relationshipGoalDisplay .goal-icon i').text(config.icon);
    }
    
    // Update preferences UI
    updatePreferencesUI(preferences) {
        const $container = $('#lookingForList');
        
        if (preferences && preferences.length > 0) {
            $container.html(
                preferences.map(pref => `
                    <div class="preference-tag">${pref.preference_text}</div>
                `).join('')
            );
        } else {
            $container.html('<p class="grey-text">No preferences added yet</p>');
        }
        
        // Update other preference details
        const data = this.profileData;
        
        // Preferred gender
        const genderMap = {
            'male': 'Male',
            'female': 'Female',
            'any': 'Any'
        };
        $('#preferredGender').text(genderMap[data.preferred_gender] || 'Any');
        
        // Age range
        const minAge = data.min_age_preference || 25;
        const maxAge = data.max_age_preference || 40;
        $('#ageRange').text(`${minAge} - ${maxAge} years`);
        
        // Demographics
        // This would need to be fetched separately
    }
    
    // Load profile statistics
    async loadProfileStats() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/profile/${this.currentUser.id}/stats`, {
                headers: authManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const stats = await response.json();
                this.updateStatsUI(stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    // Update statistics UI
    updateStatsUI(stats) {
        $('#matchCount').text(stats.matches || 0);
        $('#viewCount').text(stats.views || 0);
        $('#messageCount').text(stats.messages || 0);
        $('#matchRate').text(stats.acceptance_rate || '0%');
        $('#dailyVisitors').text(stats.daily_visitors || 0);
        $('#responseTime').text(stats.response_time || '--');
        
        // Profile completeness
        const completeness = stats.profile_completeness || 0;
        $('#profileComplete').text(`${completeness}%`);
        
        // Compatibility score
        $('#compatibilityValue').text(stats.compatibility_score || '0%');
        this.updateCompatibilityCircle(stats.compatibility_score || 0);
    }
    
    // Update compatibility circle
    updateCompatibilityCircle(score) {
        const $circle = $('#compatibilityCircle');
        const percentage = Math.min(score, 100);
        $circle.css('background', `conic-gradient(var(--emerald) ${percentage}%, var(--emerald-light) ${percentage}%)`);
    }
    
    // Load recent activity
    async loadRecentActivity() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/profile/${this.currentUser.id}/activity`, {
                headers: authManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const activity = await response.json();
                this.updateActivityUI(activity);
            }
        } catch (error) {
            console.error('Error loading activity:', error);
        }
    }
    
    // Update activity UI
    updateActivityUI(activity) {
        // Recent activity feed
        const $feed = $('#activityFeed');
        
        if (activity.recent_activity && activity.recent_activity.length > 0) {
            const activityHtml = activity.recent_activity.map(item => `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="material-icons">${item.icon || 'notifications'}</i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${item.title}</div>
                        <div class="activity-time">${item.time_ago}</div>
                    </div>
                </div>
            `).join('');
            
            $feed.html(activityHtml);
        } else {
            $feed.html('<p class="grey-text center-align">No recent activity</p>');
        }
        
        // Recent viewers
        const $viewers = $('#viewersList');
        
        if (activity.recent_viewers && activity.recent_viewers.length > 0) {
            const viewersHtml = activity.recent_viewers.map(viewer => `
                <div class="viewer-item">
                    <div class="viewer-avatar" style="background-color: ${getColorFromName(viewer.name)}">
                        ${viewer.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="viewer-info">
                        <div class="viewer-name">${viewer.name}</div>
                        <div class="viewer-time">Viewed ${viewer.time_ago}</div>
                    </div>
                </div>
            `).join('');
            
            $viewers.html(viewersHtml);
        } else {
            $viewers.html('<p class="grey-text center-align">No recent profile views</p>');
        }
    }
    
    // Initialize event listeners
    initEventListeners() {
        // Edit profile button
        $('#editProfileBtn').on('click', () => {
            this.openEditModal();
        });
        
        // View matches button
        $('#viewMatchesBtn').on('click', () => {
            window.location.href = 'matches.html';
        });
        
        // Change picture button
        $('#changePictureBtn').on('click', () => {
            this.changeProfilePicture();
        });
        
        // Change password button
        $('#changePasswordBtn').on('click', () => {
            $('#changePasswordModal').modal('open');
        });
        
        // Delete account button
        $('#deleteAccountBtn').on('click', () => {
            this.deleteAccount();
        });
        
        // Save profile button
        $('#saveProfileBtn').on('click', () => {
            this.saveProfile();
        });
        
        // Save password button
        $('#savePasswordBtn').on('click', () => {
            this.changePassword();
        });
        
        // Settings switches
        $('.switch input[type="checkbox"]').on('change', function() {
            const settingId = $(this).attr('id');
            const value = $(this).is(':checked');
            profileManager.saveSetting(settingId, value);
        });
        
        // Logout button
        $('.logout-btn').on('click', (e) => {
            e.preventDefault();
            authManager.logout();
        });
    }
    
    // Setup tabs
    setupTabs() {
        $('.tabs').tabs({
            onShow: (tab) => {
                const tabId = $(tab).attr('href');
                
                // Load data for specific tabs
                if (tabId === '#activity-tab') {
                    this.loadRecentActivity();
                }
            }
        });
    }
    
    // Open edit modal
    openEditModal() {
        // Load edit form template
        this.loadEditForm();
        $('#editProfileModal').modal('open');
    }
    
    // Load edit form
    loadEditForm() {
        const data = this.profileData;
        
        const hobbies = [
            'Reading', 'Travel', 'Sports', 'Music', 'Cooking',
            'Movies', 'Art', 'Dancing', 'Fashion', 'Photography',
            'Technology', 'Volunteering', 'Gaming'
        ];
        
        const hobbiesHtml = hobbies.map(hobby => `
            <div class="col s6 m4">
                <p>
                    <label>
                        <input type="checkbox" class="filled-in edit-hobby" value="${hobby}"
                            ${(data.hobbies || []).includes(hobby) ? 'checked' : ''}/>
                        <span>${hobby}</span>
                    </label>
                </p>
            </div>
        `).join('');
        
        const formHtml = `
            <div class="row">
                <div class="input-field col s12">
                    <input id="editUsername" type="text" value="${data.username || ''}">
                    <label for="editUsername">Username</label>
                </div>
            </div>
            
            <div class="row">
                <div class="input-field col s12">
                    <textarea id="editBio" class="materialize-textarea" maxlength="500">${data.bio || ''}</textarea>
                    <label for="editBio">About Me</label>
                    <div class="char-counter">
                        <span id="editBioCounter">${(data.bio || '').length}</span>/500
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col s12">
                    <h6>Update Hobbies (Select up to 5)</h6>
                    <div class="row" id="editHobbiesContainer">
                        ${hobbiesHtml}
                    </div>
                    <div class="hobby-counter">
                        <span id="editHobbiesCount">0</span>/5 selected
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="input-field col s12">
                    <select id="editRelationshipGoal">
                        <option value="marriage" ${data.relationship_goal === 'marriage' ? 'selected' : ''}>Marriage</option>
                        <option value="serious" ${data.relationship_goal === 'serious' ? 'selected' : ''}>Serious Relationship</option>
                        <option value="dating" ${data.relationship_goal === 'dating' ? 'selected' : ''}>Casual Dating</option>
                        <option value="friendship" ${data.relationship_goal === 'friendship' ? 'selected' : ''}>Friendship</option>
                        <option value="single_parent" ${data.relationship_goal === 'single_parent' ? 'selected' : ''}>Single Parent Support</option>
                    </select>
                    <label>Relationship Goal</label>
                </div>
            </div>
            
            <div class="row">
                <div class="input-field col s12 m6">
                    <input id="editMinAge" type="number" min="18" max="70" value="${data.min_age_preference || 25}">
                    <label for="editMinAge">Minimum Age Preference</label>
                </div>
                <div class="input-field col s12 m6">
                    <input id="editMaxAge" type="number" min="25" max="100" value="${data.max_age_preference || 40}">
                    <label for="editMaxAge">Maximum Age Preference</label>
                </div>
            </div>
        `;
        
        $('#editProfileForm').html(formHtml);
        
        // Re-initialize Materialize components
        M.updateTextFields();
        $('select').formSelect();
        
        // Set up character counter
        $('#editBio').on('input', function() {
            $('#editBioCounter').text(this.value.length);
        });
        
        // Set up hobby counter
        $('.edit-hobby').on('change', function() {
            const selected = $('.edit-hobby:checked').length;
            $('#editHobbiesCount').text(selected);
            
            if (selected > 5) {
                $(this).prop('checked', false);
                showToast('Maximum 5 hobbies allowed', 'warning');
            }
        });
        
        // Initial count
        const initialCount = $('.edit-hobby:checked').length;
        $('#editHobbiesCount').text(initialCount);
    }
    
    // Save profile
    async saveProfile() {
        const updatedData = {
            username: $('#editUsername').val().trim(),
            bio: $('#editBio').val().trim(),
            relationship_goal: $('#editRelationshipGoal').val(),
            min_age_preference: parseInt($('#editMinAge').val()) || 25,
            max_age_preference: parseInt($('#editMaxAge').val()) || 40,
            hobbies: $('.edit-hobby:checked').map(function() {
                return $(this).val();
            }).get()
        };
        
        // Validation
        if (updatedData.hobbies.length > 5) {
            showToast('Maximum 5 hobbies allowed', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/profile/${this.currentUser.id}`, {
                method: 'PUT',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify(updatedData)
            });
            
            if (response.ok) {
                showToast('Profile updated successfully!', 'success');
                
                // Update local data
                Object.assign(this.profileData, updatedData);
                Object.assign(this.currentUser, updatedData);
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                
                // Update UI
                this.updateProfileUI();
                
                // Close modal
                $('#editProfileModal').modal('close');
            } else {
                throw new Error('Failed to update profile');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            showToast('Error updating profile', 'error');
        }
    }
    
    // Change password
    async changePassword() {
        const currentPassword = $('#currentPassword').val();
        const newPassword = $('#newPassword').val();
        const confirmPassword = $('#confirmNewPassword').val();
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('Please fill in all password fields', 'error');
            return;
        }
        
        if (newPassword.length < 8) {
            showToast('New password must be at least 8 characters', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }
        
        try {
            const result = await authManager.changePassword(currentPassword, newPassword);
            
            if (result.success) {
                showToast('Password changed successfully!', 'success');
                $('#changePasswordModal').modal('close');
                $('#changePasswordForm')[0].reset();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showToast(error.message || 'Failed to change password', 'error');
        }
    }
    
    // Change profile picture
    async changeProfilePicture() {
        // This would trigger the profile picture upload flow
        // For now, we'll just redirect to a separate page or show a modal
        showToast('Profile picture change coming soon!', 'info');
    }
    
    // Save setting
    async saveSetting(settingId, value) {
        try {
            await fetch(`${this.apiBaseUrl}/users/${this.currentUser.id}/settings`, {
                method: 'PUT',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify({ [settingId]: value })
            });
            
            showToast('Setting saved', 'success');
        } catch (error) {
            console.error('Error saving setting:', error);
        }
    }
    
    // Delete account
    async deleteAccount() {
        const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
        
        if (!confirmed) return;
        
        try {
            const result = await authManager.deleteAccount();
            
            if (result.success) {
                window.location.href = 'index.html';
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            showToast(error.message || 'Failed to delete account', 'error');
        }
    }
    
    // Helper methods
    calculateAge(dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// Initialize profile manager globally
window.profileManager = new ProfileManager();