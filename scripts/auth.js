// auth.js - Akwa-Connect Authentication System
class AuthManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api'; // Change to your Render URL in production
        this.currentUser = null;
        this.authToken = null;
        
        this.loadFromStorage();
    }
    
    
    // Load auth data from localStorage
    loadFromStorage() {
        try {
            const userData = localStorage.getItem('currentUser');
            const token = localStorage.getItem('authToken');
            
            if (userData && token) {
                this.currentUser = JSON.parse(userData);
                this.authToken = token;
                
                // Verify token is still valid
                this.verifyToken();
            }
        } catch (error) {
            console.error('Error loading auth data:', error);
            this.logout();
        }
    }
    
    // Save auth data to localStorage
    saveToStorage() {
        try {
            if (this.currentUser) {
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            }
            if (this.authToken) {
                localStorage.setItem('authToken', this.authToken);
            }
        } catch (error) {
            console.error('Error saving auth data:', error);
        }
    }
    
        // Register new user
        async register(userData) {
        try {
            // First register user
            const response = await fetch(`${this.apiBaseUrl}/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userData.email,
                    password: userData.password,
                    profile: {
                        username: userData.username,
                        full_name: '', // User can add this later
                        dob: userData.dob,
                        gender: userData.gender,
                        lga: userData.lga,
                        city: userData.city,
                        hobbies: userData.hobbies || [],
                        bio: userData.bio || '',
                        has_disability: userData.hasDisability || false,
                        disability_desc: userData.disabilityDesc || '',
                        preferred_gender: userData.preferredGender || 'any',
                        min_age_preference: parseInt(userData.minAgePreference) || 25,
                        max_age_preference: parseInt(userData.maxAgePreference) || 40,
                        newsletter_subscribed: userData.newsletter !== false
                    }
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }
            
            // Store user ID
            const userId = data.user.id;
            
            // Upload profile picture if exists
            if (userData.profilePicture) {
                try {
                    // Upload profile picture
                    const uploadResult = await this.uploadProfilePicture(userId, userData.profilePicture);
                    if (uploadResult) {
                        data.user.profile_picture_url = uploadResult;
                    }
                } catch (uploadError) {
                    console.warn('Profile picture upload failed:', uploadError);
                    // Continue without picture
                }
            }
            
            // Save preferences
            if (userData.preferences && userData.preferences.length > 0) {
                await this.saveUserPreferences(userId, userData.preferences);
            }
            
            // Save demographic preferences
            if (userData.demographics && userData.demographics.length > 0) {
                await this.saveDemographicPreferences(userId, userData.demographics);
            }
            
            // Auto-login after successful registration
            await this.login(userData.email, userData.password);
            
            return { success: true, user: this.currentUser };
            
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Login user
    async login(email, password) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            
            // Store auth data
            this.currentUser = data.user;
            this.authToken = data.session?.access_token || 'demo-token'; // Supabase returns session object
            
            // Fetch complete user profile
            await this.fetchUserProfile();
            
            // Save to storage
            this.saveToStorage();
            
            // Update UI
            this.updateAuthUI();
            
            // Show success message
            showToast('Welcome back!', 'success');
            
            return { success: true, user: this.currentUser };
            
        } catch (error) {
            console.error('Login error:', error);
            showToast(error.message || 'Login failed', 'error');
            return { success: false, error: error.message };
        }
    }
    
    // Fetch complete user profile
    async fetchUserProfile() {
        try {
            if (!this.currentUser?.id) return;
            
            const response = await fetch(`${this.apiBaseUrl}/profile/${this.currentUser.id}`, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const profile = await response.json();
                this.currentUser = { ...this.currentUser, ...profile };
                this.saveToStorage();
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    }
    
    // Logout user
    logout() {
        this.currentUser = null;
        this.authToken = null;
        
        // Clear localStorage
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        
        // Update UI
        this.updateAuthUI();
        
        // Show message
        showToast('Logged out successfully', 'info');
        
        // Redirect to home page
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
    
    // Verify token validity
    async verifyToken() {
        try {
            if (!this.authToken || !this.currentUser?.id) {
                this.logout();
                return false;
            }
            
            // For demo purposes, we'll just check localStorage
            // In production, you would verify with your backend
            const storedUser = localStorage.getItem('currentUser');
            if (!storedUser) {
                this.logout();
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('Token verification error:', error);
            this.logout();
            return false;
        }
    }
    
    // Check if user is authenticated
    isAuthenticated() {
        return !!this.currentUser && !!this.authToken;
    }
    
    // Get authentication headers for API requests
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
        };
    }
    
    // Update UI based on auth status
    updateAuthUI() {
        const authManager = window.authManager;
        
        if (authManager.isAuthenticated()) {
            // Show user-only elements
            document.querySelectorAll('.user-only').forEach(el => {
                el.style.display = 'block';
            });
            
            // Hide guest-only elements
            document.querySelectorAll('.guest-only').forEach(el => {
                el.style.display = 'none';
            });
            
            // Update user info
            document.querySelectorAll('.user-name').forEach(el => {
                if (authManager.currentUser.full_name) {
                    el.textContent = authManager.currentUser.full_name.split(' ')[0];
                }
            });
            
            // Update avatar
            document.querySelectorAll('.user-avatar').forEach(el => {
                if (authManager.currentUser.full_name) {
                    const firstLetter = authManager.currentUser.full_name.charAt(0).toUpperCase();
                    el.textContent = firstLetter;
                    el.style.backgroundColor = getColorFromName(authManager.currentUser.full_name);
                }
            });
            
        } else {
            // Show guest-only elements
            document.querySelectorAll('.guest-only').forEach(el => {
                el.style.display = 'block';
            });
            
            // Hide user-only elements
            document.querySelectorAll('.user-only').forEach(el => {
                el.style.display = 'none';
            });
        }
    }
    
    // Update user profile
    async updateProfile(updates) {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated');
            }
            
            const response = await fetch(`${this.apiBaseUrl}/profile/${this.currentUser.id}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updates)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Profile update failed');
            }
            
            // Update local user data
            this.currentUser = { ...this.currentUser, ...updates };
            this.saveToStorage();
            
            // Update UI
            this.updateAuthUI();
            
            showToast('Profile updated successfully!', 'success');
            
            return { success: true, user: this.currentUser };
            
        } catch (error) {
            console.error('Profile update error:', error);
            showToast(error.message || 'Update failed', 'error');
            return { success: false, error: error.message };
        }
    }
    
    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            // This would call your backend password change endpoint
            // For now, we'll simulate it
            const response = await fetch(`${this.apiBaseUrl}/change-password`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });
            
            if (!response.ok) {
                throw new Error('Password change failed');
            }
            
            showToast('Password changed successfully!', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('Password change error:', error);
            showToast(error.message || 'Password change failed', 'error');
            return { success: false, error: error.message };
        }
    }
    
    // Reset password (forgot password)
    async resetPassword(email) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            if (!response.ok) {
                throw new Error('Password reset request failed');
            }
            
            showToast('Password reset instructions sent to your email', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('Password reset error:', error);
            showToast(error.message || 'Reset failed', 'error');
            return { success: false, error: error.message };
        }
    }
    
    // Delete account
    async deleteAccount() {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated');
            }
            
            const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
            if (!confirmed) return { success: false };
            
            const response = await fetch(`${this.apiBaseUrl}/profile/${this.currentUser.id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Account deletion failed');
            }
            
            // Logout and clear data
            this.logout();
            
            showToast('Account deleted successfully', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('Account deletion error:', error);
            showToast(error.message || 'Deletion failed', 'error');
            return { success: false, error: error.message };
        }
    }

    
}

AuthManager.prototype.uploadProfilePicture = async function(userId, imageData) {
    try {
        const response = await fetch(`${this.apiBaseUrl}/users/${userId}/profile-picture`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ imageData })
        });
        
        const data = await response.json();
        return data.imageUrl;
    } catch (error) {
        console.error('Profile picture upload error:', error);
        // Store locally as fallback
        localStorage.setItem(`profile_picture_${userId}`, imageData);
        return imageData;
    }
};

AuthManager.prototype.saveUserPreferences = async function(userId, preferences) {
    try {
        const response = await fetch(`${this.apiBaseUrl}/users/${userId}/preferences`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ preferences })
        });
        
        return await response.json();
    } catch (error) {
        console.error('Save preferences error:', error);
    }
};

AuthManager.prototype.saveDemographicPreferences = async function(userId, demographics) {
    try {
        const response = await fetch(`${this.apiBaseUrl}/users/${userId}/demographic-preferences`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ demographics })
        });
        
        return await response.json();
    } catch (error) {
        console.error('Save demographics error:', error);
    }
};



// Initialize Auth Manager
const authManager = new AuthManager();

// Make available globally
window.authManager = authManager;

// Signup Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
        
        // Initialize form validation
        initSignupFormValidation();
    }
    
    // Login Form Handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout buttons
    document.querySelectorAll('.logout-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            authManager.logout();
        });
    });
    
    // Update UI on page load
    authManager.updateAuthUI();
});

// Handle signup form submission
async function handleSignup(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Get form data
    const formData = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        fullName: document.getElementById('fullname').value,
        dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        lga: document.getElementById('lga').value,
        city: document.getElementById('city').value,
        hobbies: getSelectedHobbies(),
        bio: document.getElementById('bio').value,
        preferences: document.getElementById('preferences').value,
        disabilityDesc: document.getElementById('disabilityDesc').value,
        relationshipGoal: document.getElementById('relationshipGoal').value,
        minAge: document.getElementById('minAge').value,
        maxAge: document.getElementById('maxAge').value
    };
    
    // Validate form
    const validation = validateSignupForm(formData);
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i> Creating Account...';
    
    try {
        // Register user
        const result = await authManager.register(formData);
        
        if (result.success) {
            // Redirect to profile page
            window.location.href = 'profile.html';
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Signup error:', error);
        showToast(error.message || 'Signup failed. Please try again.', 'error');
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Account';
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Basic validation
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i> Logging in...';
    
    try {
        const result = await authManager.login(email, password);
        
        if (result.success) {
            // Redirect to matches page
            window.location.href = 'matches.html';
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Login';
    }
}

// Get selected hobbies from checkboxes
function getSelectedHobbies() {
    const checkboxes = document.querySelectorAll('.hobby-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Initialize signup form validation
function initSignupFormValidation() {
    // Password confirmation check
    const passwordField = document.getElementById('password');
    const confirmField = document.getElementById('confirmPassword');
    
    if (passwordField && confirmField) {
        confirmField.addEventListener('input', function() {
            if (passwordField.value !== confirmField.value) {
                confirmField.setCustomValidity('Passwords do not match');
            } else {
                confirmField.setCustomValidity('');
            }
        });
    }
    
    // Hobby limit (max 5)
    const hobbyCheckboxes = document.querySelectorAll('.hobby-checkbox');
    if (hobbyCheckboxes.length > 0) {
        hobbyCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const checked = document.querySelectorAll('.hobby-checkbox:checked');
                if (checked.length > 5) {
                    this.checked = false;
                    showToast('Maximum 5 hobbies allowed', 'warning');
                }
            });
        });
    }
    
    // Bio character counter
    const bioField = document.getElementById('bio');
    const bioCounter = document.getElementById('bio-counter');
    if (bioField && bioCounter) {
        bioField.addEventListener('input', function() {
            bioCounter.textContent = `${this.value.length}/500`;
        });
    }
    
    // Disability field toggle
    const disabilityCheckbox = document.getElementById('hasDisability');
    const disabilityField = document.getElementById('disabilityField');
    if (disabilityCheckbox && disabilityField) {
        disabilityCheckbox.addEventListener('change', function() {
            disabilityField.style.display = this.checked ? 'block' : 'none';
        });
    }
}

// Validate signup form data
function validateSignupForm(data) {
    // Check required fields
    const required = ['email', 'password', 'fullName', 'dob', 'gender', 'lga', 'city'];
    for (const field of required) {
        if (!data[field] || data[field].trim() === '') {
            return {
                valid: false,
                message: `Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} field`
            };
        }
    }
    
    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        return {
            valid: false,
            message: 'Please enter a valid email address'
        };
    }
    
    // Check password strength
    if (data.password.length < 6) {
        return {
            valid: false,
            message: 'Password must be at least 6 characters long'
        };
    }
    
    // Check password match
    if (data.password !== data.confirmPassword) {
        return {
            valid: false,
            message: 'Passwords do not match'
        };
    }
    
    // Check age (must be 18+)
    const dob = new Date(data.dob);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    
    if (age < 18) {
        return {
            valid: false,
            message: 'You must be 18 years or older to join'
        };
    }
    
    // Check age preference range
    const minAge = parseInt(data.minAge) || 25;
    const maxAge = parseInt(data.maxAge) || 40;
    if (minAge > maxAge) {
        return {
            valid: false,
            message: 'Minimum age cannot be greater than maximum age'
        };
    }
    
    // Check max hobbies
    if (data.hobbies && data.hobbies.length > 5) {
        return {
            valid: false,
            message: 'Maximum 5 hobbies allowed'
        };
    }
    
    return { valid: true, message: '' };
}

// Password visibility toggle
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
}


// Check if user is admin
async function checkAdminStatus() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const token = localStorage.getItem('authToken');
        
        if (!currentUser.id || !token) {
            return false;
        }
        
        // In production, you would verify with backend
        // For now, check localStorage flag
        return currentUser.is_admin === true;
        
    } catch (error) {
        console.error('Admin check error:', error);
        return false;
    }
}

// Add to AuthManager class
AuthManager.prototype.isAdmin = function() {
    return this.currentUser?.is_admin === true;
};

// Export functions
window.AuthUtils = {
    togglePasswordVisibility,
    validateSignupForm,
    getSelectedHobbies
};

