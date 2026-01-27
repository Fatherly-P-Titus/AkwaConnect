// main.js - Akwa-Connect Main Application File (jQuery Version)
$(document).ready(function() {
    console.log('Akwa-Connect loaded successfully');
    
    // Initialize Materialize components
    M.AutoInit();
    
    // Initialize PWA features
    if (typeof pwaHandler !== 'undefined') {
        pwaHandler.init();
    }
    
    // Initialize all components
    initApplication();
});

// Initialize application
function initApplication() {
    // Check authentication status
    checkAuthStatus();
    
    // Initialize navigation
    initNavigation();
    
    // Initialize modals
    initModals();
    
    // Initialize carousels
    initCarousels();
    
    // Set current year in footer
    setCurrentYear();
    
    // Initialize analytics (basic)
    initAnalytics();
    
    // Load user data if logged in
    loadUserData();
    
    // Set up event listeners
    setupEventListeners();
}

// Check authentication status
function checkAuthStatus() {
    const currentUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('authToken');
    
    if (currentUser && token) {
        updateUIForLoggedInUser(JSON.parse(currentUser));
    } else {
        updateUIForGuest();
    }
}

// Update UI for logged-in users
function updateUIForLoggedInUser(user) {
    // Show/hide elements based on auth status
    $('.guest-only').hide();
    $('.user-only').show();
    
    // Update user info
    $('.user-name').each(function() {
        if (user.full_name) {
            $(this).text(user.full_name.split(' ')[0]);
        } else if (user.username) {
            $(this).text(user.username);
        }
    });
    
    // Update avatar with profile picture if available
    $('.user-avatar, .nav-profile-pic').each(function() {
        const $element = $(this);
        const isImage = $element.hasClass('nav-profile-pic');
        
        if (user.profile_picture_url) {
            if (isImage) {
                $element.attr('src', user.profile_picture_url).show();
                $element.next('.user-avatar').hide();
            } else {
                // Fallback to colored avatar
                this.textContent = user.username?.charAt(0).toUpperCase() || 'U';
                this.style.backgroundColor = getColorFromName(user.username || 'User');
            }
        } else {
            if (isImage) {
                $element.hide();
                $element.next('.user-avatar').show();
            }
            // Update avatar with initials
            const firstLetter = (user.username || 'U').charAt(0).toUpperCase();
            this.textContent = firstLetter;
            this.style.backgroundColor = getColorFromName(user.username || 'User');
        }
    });
}

// Update UI for guests
function updateUIForGuest() {
    $('.guest-only').show();
    $('.user-only').hide();
}

// Get color from user name (for avatar)
function getColorFromName(name) {
    const colors = [
        '#10b981', // Emerald
        '#f59e0b', // Gold
        '#3b82f6', // Blue
        '#8b5cf6', // Purple
        '#ec4899', // Pink
        '#ef4444', // Red
        '#14b8a6', // Teal
        '#f97316'  // Orange
    ];
    
    const hash = name.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
}

// Initialize navigation
function initNavigation() {
    // Mobile sidenav
    $('.sidenav').sidenav();
    
    // Dropdowns
    $('.dropdown-trigger').dropdown({
        coverTrigger: false,
        constrainWidth: false
    });
    
    // Active link highlighting
    highlightActiveNavLink();
}

// Highlight active navigation link
function highlightActiveNavLink() {
    const currentPath = window.location.pathname;
    
    $('nav a, .sidenav a').each(function() {
        const $link = $(this);
        const href = $link.attr('href');
        
        if (href === currentPath || 
            (currentPath.includes(href) && href !== '/') ||
            (currentPath === '/' && (href === 'index.html' || href === '/' || href === ''))) {
            $link.addClass('active');
        } else {
            $link.removeClass('active');
        }
    });
}

// Initialize modals
function initModals() {
    $('.modal').modal({
        opacity: 0.5,
        inDuration: 250,
        outDuration: 250,
        startingTop: '4%',
        endingTop: '10%'
    });
}

// Initialize carousels
function initCarousels() {
    $('.carousel').carousel({
        fullWidth: false,
        indicators: true,
        duration: 200
    });
    
    // Auto-rotate hero carousel
    setInterval(() => {
        $('.carousel').carousel('next');
    }, 5000);
    
    // Initialize carousel slider
    $('.carousel-slider').carousel({
        fullWidth: true,
        indicators: true
    });
}

// Set current year in footer
function setCurrentYear() {
    const currentYear = new Date().getFullYear();
    $('.current-year').text(currentYear);
}

// Initialize basic analytics
function initAnalytics() {
    // Track page views (simplified)
    const pageView = {
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };
    
    // Save to localStorage for basic analytics
    const analytics = JSON.parse(localStorage.getItem('akwaAnalytics') || '[]');
    analytics.push(pageView);
    
    // Keep only last 100 entries
    if (analytics.length > 100) {
        analytics.splice(0, analytics.length - 100);
    }
    
    localStorage.setItem('akwaAnalytics', JSON.stringify(analytics));
}

// Load user data if logged in
async function loadUserData() {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return;
    
    try {
        const user = JSON.parse(currentUser);
        const token = localStorage.getItem('authToken');
        
        // You could fetch fresh user data here
        // const response = await fetch(`/api/user/${user.id}`, {
        //     headers: { 'Authorization': `Bearer ${token}` }
        // });
        // const freshData = await response.json();
        // localStorage.setItem('currentUser', JSON.stringify(freshData));
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading user data', 'error');
    }
}

// Set up event listeners
function setupEventListeners() {
    // Login form submission
    $('#login-submit').on('click', function(e) {
        e.preventDefault();
        handleLogin();
    });
    
    // Logout button
    $('#logout-btn').on('click', function(e) {
        e.preventDefault();
        handleLogout();
    });
    
    // Smooth scroll for anchor links
    $('a[href^="#"]').not('[href="#"]').not('[href="#0"]').on('click', function(e) {
        if ($(this).attr('href').startsWith('#') && $(this).attr('href') !== '#!') {
            e.preventDefault();
            const target = $(this).attr('href');
            
            if ($(target).length) {
                $('html, body').animate({
                    scrollTop: $(target).offset().top - 80
                }, 600);
                
                // Close mobile sidenav if open
                if ($('.sidenav').sidenav('instance')) {
                    $('.sidenav').sidenav('close');
                }
            }
        }
    });
    
    // Form enter key submission
    $('#login-form input').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            handleLogin();
        }
    });
}

// Handle login
function handleLogin() {
    const email = $('#email').val();
    const password = $('#password').val();
    
    if (!email || !password) {
        showToast('Please enter both email and password', 'error');
        return;
    }
    
    // Demo login - Replace with actual API call
    if (email === 'demo@akwaconnect.ng' && password === 'demo123') {
        const demoUser = {
            id: 1,
            email: email,
            full_name: 'Demo User',
            location: 'Uyo',
            age: 28
        };
        
        localStorage.setItem('currentUser', JSON.stringify(demoUser));
        localStorage.setItem('authToken', 'demo-token-' + Date.now());
        
        updateUIForLoggedInUser(demoUser);
        $('#login').modal('close');
        showToast('Welcome back!', 'success');
        
        // Reset form
        $('#login-form')[0].reset();
    } else {
        showToast('Invalid email or password', 'error');
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    updateUIForGuest();
    showToast('Logged out successfully', 'success');
}

// Show toast notification
function showToast(message, type = 'info', duration = 4000) {
    let backgroundColor = '';
    
    switch(type) {
        case 'success':
            backgroundColor = '#10b981';
            break;
        case 'error':
            backgroundColor = '#ef4444';
            break;
        case 'warning':
            backgroundColor = '#f59e0b';
            break;
        default:
            backgroundColor = '#3b82f6';
    }
    
    M.toast({
        html: message,
        classes: 'rounded',
        displayLength: duration,
        inDuration: 300,
        outDuration: 375
    });
}

// Format date nicely
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // If today
    if (date.toDateString() === now.toDateString()) {
        return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If within last week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()] + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise full date
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for performance
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Export functions for use in other files
window.AkwaConnect = window.AkwaConnect || {};
window.AkwaConnect.Utils = {
    showToast,
    formatDate,
    debounce,
    throttle,
    getColorFromName
};

// Make functions available globally
window.showToast = showToast;
window.formatDate = formatDate;