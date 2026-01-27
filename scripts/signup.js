// signup.js - Enhanced signup form with multi-step functionality
$(document).ready(function() {
    // Initialize Materialize components
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        yearRange: [1950, new Date().getFullYear()],
        maxDate: new Date(),
        defaultDate: new Date(1990, 0, 1),
        autoClose: true
    });
    
    $('select').formSelect();
    $('.modal').modal();
    
    // Initialize multi-step form
    initMultiStepForm();
    
    // Initialize form validation
    initFormValidation();
    
    // Setup event listeners
    setupEventListeners();

        // Load Cropper.js if not already loaded
    if (!window.Cropper) {
        const cropperScript = document.createElement('script');
        cropperScript.src = 'scripts/Cropper.min.js';
        cropperScript.onload = function() {
            // Initialize profile picture handler after Cropper loads
            if (window.ProfilePictureHandler) {
                profilePictureHandler = new ProfilePictureHandler();
            }
        };
        document.head.appendChild(cropperScript);
        
        // Add Cropper CSS
        const cropperCSS = document.createElement('link');
        cropperCSS.rel = 'stylesheet';
        cropperCSS.href = 'styles/Cropper.css';
        document.head.appendChild(cropperCSS);
    }

});

// Initialize multi-step form
function initMultiStepForm() {
    const $steps = $('.form-step');
    const $progress = $('.progress .determinate');
    const totalSteps = $steps.length;
    
    // Show first step
    showStep(1);
    updateProgress(1, totalSteps);
}

// Show specific step
function showStep(stepNumber) {
    const $steps = $('.form-step');
    const $progressSteps = $('.progress-steps .step');
    
    // Hide all steps
    $steps.removeClass('active').hide();
    
    // Show current step
    $(`.form-step[data-step="${stepNumber}"]`).show().addClass('active');
    
    // Update progress steps
    $progressSteps.removeClass('active');
    $(`.progress-steps .step[data-step="${stepNumber}"]`).addClass('active');
}

// Update progress bar
function updateProgress(currentStep, totalSteps) {
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    $('.progress .determinate').css('width', `${progressPercent}%`);
}

// Validate current step
function validateStep(stepNumber) {
    const $step = $(`.form-step[data-step="${stepNumber}"]`);
    let isValid = true;
    
    switch(stepNumber) {
        case 1: // Basic Info
            const username = $('#username').val();
            const email = $('#email').val();
            const dob = $('#dob').val();
            const gender = $('input[name="gender"]:checked').val();
            
            if (!username || username.trim().length < 3) {
                showToast('Username must be at least 3 characters', 'error');
                isValid = false;
            } else if (!email || !validateEmail(email)) {
                showToast('Please enter a valid email address', 'error');
                isValid = false;
            } else if (!dob) {
                showToast('Please select your date of birth', 'error');
                isValid = false;
            } else if (!gender) {
                showToast('Please select your gender', 'error');
                isValid = false;
            }
            break;
            
        case 2: // Location
            const lga = $('#lga').val();
            const city = $('#city').val();
            
            if (!lga) {
                showToast('Please select your LGA', 'error');
                isValid = false;
            } else if (!city || city.trim().length < 2) {
                showToast('Please enter your city/town', 'error');
                isValid = false;
            }
            break;
            
        case 3: // Interests
            const bio = $('#bio').val();
            const hobbies = getSelectedHobbies();
            
            if (!bio || bio.trim().length < 50) {
                showToast('Please write a bio of at least 50 characters', 'error');
                isValid = false;
            } else if (hobbies.length === 0) {
                showToast('Please select at least one hobby', 'error');
                isValid = false;
            }
            break;
            
        case 4: // Preferences
            const preferences = getPreferences();
            if (preferences.length === 0) {
                showToast('Please add at least one preference', 'error');
                isValid = false;
            }
            break;
            
        case 5: // Account
            const password = $('#password').val();
            const confirmPassword = $('#confirmPassword').val();
            const terms = $('#terms').is(':checked');
            
            if (!password || password.length < 8) {
                showToast('Password must be at least 8 characters', 'error');
                isValid = false;
            } else if (password !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                isValid = false;
            } else if (!terms) {
                showToast('You must agree to the Terms of Service', 'error');
                isValid = false;
            }
            break;
    }
    
    return isValid;
}

// Get selected hobbies
function getSelectedHobbies() {
    return $('.hobby-checkbox:checked').map(function() {
        return $(this).val();
    }).get();
}

// Get preferences as array
function getPreferences() {
    return $('#preferences-container .preference-item').map(function() {
        return $(this).data('value');
    }).get();
}

// Add preference to list
function addPreference(value) {
    if (!value || value.trim() === '') return;
    
    const $container = $('#preferences-container');
    const preferenceText = value.trim();
    
    // Check if already exists
    const existing = $container.find('.preference-item').filter(function() {
        return $(this).data('value').toLowerCase() === preferenceText.toLowerCase();
    });
    
    if (existing.length > 0) {
        showToast('Preference already added', 'warning');
        return;
    }
    
    // Create new preference item
    const $item = $(`
        <div class="preference-item" data-value="${preferenceText}">
            <span>${preferenceText}</span>
            <button type="button" class="btn-flat btn-small remove-preference">
                <i class="material-icons">close</i>
            </button>
        </div>
    `);
    
    $container.append($item);
    $('#preference-input').val('');
    
    // Add remove functionality
    $item.find('.remove-preference').on('click', function() {
        $(this).closest('.preference-item').remove();
    });
}

// Validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Calculate password strength
function calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    return strength;
}

// Update password strength indicator
function updatePasswordStrength() {
    const password = $('#password').val();
    const strength = calculatePasswordStrength(password);
    const $bar = $('.strength-bar');
    const $text = $('.strength-text');
    
    let color = '#ef4444'; // Red
    let text = 'Weak';
    
    switch(strength) {
        case 2:
            color = '#f59e0b'; // Gold
            text = 'Fair';
            break;
        case 3:
            color = '#3b82f6'; // Blue
            text = 'Good';
            break;
        case 4:
            color = '#10b981'; // Emerald
            text = 'Strong';
            break;
    }
    
    $bar.css({
        'width': `${strength * 25}%`,
        'background-color': color
    });
    $text.text(`Password strength: ${text}`);
}

// Initialize form validation
function initFormValidation() {
    // Hobby selection limit
    $('.hobby-checkbox').on('change', function() {
        const selectedCount = $('.hobby-checkbox:checked').length;
        $('#selected-hobbies-count').text(selectedCount);
        
        if (selectedCount > 5) {
            $(this).prop('checked', false);
            showToast('Maximum 5 hobbies allowed', 'warning');
        }
    });
    
    // Bio character counter
    $('#bio').on('input', function() {
        const length = $(this).val().length;
        $('#bio-counter').text(length);
        
        if (length >= 500) {
            $(this).val($(this).val().substring(0, 500));
        }
    });
    
    // Disability field toggle
    $('#hasDisability').on('change', function() {
        if ($(this).is(':checked')) {
            $('#disabilityField').show();
        } else {
            $('#disabilityField').hide().val('');
        }
    });
    
    // Password strength indicator
    $('#password').on('input', updatePasswordStrength);
    
    // Age range validation
    $('#minAge, #maxAge').on('change', function() {
        const minAge = parseInt($('#minAge').val()) || 18;
        const maxAge = parseInt($('#maxAge').val()) || 40;
        
        if (minAge > maxAge) {
            showToast('Minimum age cannot be greater than maximum age', 'error');
            $('#minAge').val(maxAge);
        }
        
        if (minAge < 18) $('#minAge').val(18);
        if (maxAge > 100) $('#maxAge').val(100);
    });
    
    // Add preference on button click
    $('#add-preference').on('click', function() {
        const value = $('#preference-input').val();
        addPreference(value);
    });
    
    // Add preference on Enter key
    $('#preference-input').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            addPreference($(this).val());
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Next step buttons
    $('.next-step').on('click', function() {
        const currentStep = parseInt($('.form-step.active').data('step'));
        const totalSteps = $('.form-step').length;
        
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                showStep(currentStep + 1);
                updateProgress(currentStep + 1, totalSteps);
            }
        }
    });
    
    // Previous step buttons
    $('.prev-step').on('click', function() {
        const currentStep = parseInt($('.form-step.active').data('step'));
        const totalSteps = $('.form-step').length;
        
        if (currentStep > 1) {
            showStep(currentStep - 1);
            updateProgress(currentStep - 1, totalSteps);
        }
    });
    
    // Form submission
    $('#signupForm').on('submit', async function(e) {
        e.preventDefault();
        
        if (!validateStep(5)) {
            return;
        }
        
        const submitBtn = $('.submit-btn');
        const originalText = submitBtn.html();
        
        // Show loading state
        submitBtn.prop('disabled', true).html('<i class="material-icons left">hourglass_empty</i> Creating Account...');
        
        try {
            // Get all form data
            const formData = {
                username: $('#username').val().trim(),
                email: $('#email').val().trim(),
                dob: $('#dob').val(),
                gender: $('input[name="gender"]:checked').val(),
                lga: $('#lga').val(),
                city: $('#city').val().trim(),
                hobbies: getSelectedHobbies(),
                bio: $('#bio').val().trim(),
                preferences: getPreferences(),
                disabilityDesc: $('#disabilityDesc').val().trim(),
                hasDisability: $('#hasDisability').is(':checked'),
                preferredGender: $('#preferredGender').val(),
                minAgePreference: parseInt($('#minAge').val()) || 25,
                maxAgePreference: parseInt($('#maxAge').val()) || 40,
                demographics: $('.demographic-checkbox:checked').map(function() {
                    return $(this).val();
                }).get(),
                password: $('#password').val(),
                confirmPassword: $('#confirmPassword').val(),
                newsletter: $('#newsletter').is(':checked'),
                profilePicture: profilePictureHandler?.getImageData() || null  // NEW: Add profile picture
            };
            
            // Register user
            const result = await authManager.register(formData);
            
            if (result.success) {
                showToast('Account created successfully!', 'success');
                
                // Redirect to profile page after 2 seconds
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 2000);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Signup error:', error);
            showToast(error.message || 'Signup failed. Please try again.', 'error');
            
            // Reset button
            submitBtn.prop('disabled', false).html(originalText);
        }
    });
}