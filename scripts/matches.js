// matches.js - Handle matching interface with ES6 and jQuery
$(document).ready(async () => {
    // Initialize Materialize components
    M.AutoInit();
    
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
    let currentMatches = [];
    let currentMatchIndex = 0;
    let currentMode = 'algorithm';
    
    // Cache DOM elements
    const $algorithmSection = $('#algorithmSection');
    const $manualSection = $('#manualSection');
    const $algorithmModeBtn = $('#algorithmMode');
    const $manualModeBtn = $('#manualMode');
    const $matchesContainer = $('#matchesContainer');
    const $manualMatchesContainer = $('#manualMatchesContainer');
    const $passBtn = $('#passBtn');
    const $likeBtn = $('#likeBtn');
    const $applyFiltersBtn = $('#applyFilters');
    const $clearFiltersBtn = $('#clearFilters');
    const $hobbyFilters = $('#hobbyFilters');
    const $matchModal = $('#matchModal');
    
    // Check authentication
    const checkAuth = () => {
        if (!currentUser.id) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    };
    
    // Initialize page
    const initializePage = async () => {
        if (!checkAuth()) return;
        
        await loadAlgorithmMatches();
        initializeHobbyFilters();
        initializeEventListeners();
    };
    
    // Initialize event listeners
    const initializeEventListeners = () => {
        $algorithmModeBtn.on('click', () => switchMode('algorithm'));
        $manualModeBtn.on('click', () => switchMode('manual'));
        $passBtn.on('click', handlePass);
        $likeBtn.on('click', handleLike);
        $applyFiltersBtn.on('click', applyManualFilters);
        $clearFiltersBtn.on('click', clearFilters);
    };
    
    // Switch between algorithm and manual mode
    const switchMode = (mode) => {
        currentMode = mode;
        
        if (mode === 'algorithm') {
            $algorithmSection.show();
            $manualSection.hide();
            $algorithmModeBtn.addClass('active');
            $manualModeBtn.removeClass('active');
            loadAlgorithmMatches();
        } else {
            $algorithmSection.hide();
            $manualSection.show();
            $manualModeBtn.addClass('active');
            $algorithmModeBtn.removeClass('active');
        }
    };
    
    // Load algorithm matches
    const loadAlgorithmMatches = async () => {
        try {
            const response = await fetch(`http://localhost:3000/api/matches/${currentUser.id}`);
            const data = await response.json();
            
            if (data.matches?.length > 0) {
                currentMatches = data.matches;
                currentMatchIndex = 0;
                displayCurrentMatch();
            } else {
                showEmptyState($matchesContainer);
            }
        } catch (error) {
            console.error('Error loading matches:', error);
            showErrorState($matchesContainer, 'Failed to load matches. Please try again.');
        }
    };
    
    // Apply manual filters
    const applyManualFilters = async () => {
        const filters = {
            lga: $('#filterLGA').val(),
            minAge: $('#filterMinAge').val(),
            maxAge: $('#filterMaxAge').val(),
            goal: $('#filterGoal').val(),
            hobbies: $('.filter-hobby:checked').map((_, cb) => cb.value).get()
        };
        
        try {
            const response = await fetch(
                `http://localhost:3000/api/matches/${currentUser.id}?manual=true`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filters })
                }
            );
            
            const data = await response.json();
            
            if (data.matches?.length > 0) {
                currentMatches = data.matches;
                currentMatchIndex = 0;
                displayManualResults();
            } else {
                showEmptyState($manualMatchesContainer, 'No matches found', 'Try adjusting your filters');
            }
        } catch (error) {
            console.error('Error applying filters:', error);
            showErrorState($manualMatchesContainer, 'Error applying filters');
        }
    };
    
    // Display current match (algorithm mode)
    const displayCurrentMatch = () => {
        if (currentMatches.length === 0 || currentMatchIndex >= currentMatches.length) {
            showEmptyState($matchesContainer);
            return;
        }
        
        const match = currentMatches[currentMatchIndex];
        const matchUser = match.user || match;
        const matchCard = createMatchCard(matchUser, match.score, match.reasons);
        
        $matchesContainer.html(matchCard);
    };
    
    // Display manual search results
    const displayManualResults = () => {
        $manualMatchesContainer.empty();
        
        currentMatches.forEach(match => {
            const matchUser = match.user || match;
            const matchCard = createMatchCard(matchUser, match.score, match.reasons);
            $manualMatchesContainer.append(matchCard);
        });
    };
    
    // Create match card HTML
    const createMatchCard = (user, score = 0, reasons = []) => {
        const age = calculateAge(user.dob);
        const avatarInitial = user.full_name?.[0]?.toUpperCase() || '?';
        const avatarColor = getAvatarColor(user.id);
        
        return `
            <div class="profile-card">
                <div class="profile-header">
                    <div class="compatibility-badge">${score}%</div>
                </div>
                <div class="profile-avatar" style="background: ${avatarColor}">
                    ${user.profile_picture ? 
                        `<img src="${user.profile_picture}" alt="${user.full_name}">` :
                        `<span class="cz-bold" style="color: white; font-size: 2.5rem;">${avatarInitial}</span>`
                    }
                </div>
                <div class="profile-body">
                    <h4 class="cz-black">${user.full_name || 'Anonymous'}</h4>
                    <p class="cz-regular">
                        ${age} years • ${user.lga || 'Unknown LGA'} 
                        ${user.city ? `• ${user.city}` : ''}
                    </p>
                    
                    ${user.bio ? `
                    <div class="section-divider"></div>
                    <h6 class="cz-bold">About</h6>
                    <p>${truncateText(user.bio, 150)}</p>
                    ` : ''}
                    
                    ${user.hobbies?.length > 0 ? `
                    <h6 class="cz-bold">Hobbies & Interests</h6>
                    <div class="hobbies-list">
                        ${user.hobbies.slice(0, 5).map(hobby => 
                            `<span class="hobby-chip">${hobby}</span>`
                        ).join('')}
                        ${user.hobbies.length > 5 ? 
                            `<span class="hobby-chip">+${user.hobbies.length - 5} more</span>` : ''
                        }
                    </div>
                    ` : ''}
                    
                    ${reasons.length > 0 ? `
                    <div class="section-divider"></div>
                    <h6 class="cz-bold">Why you might match</h6>
                    <div class="match-reasons">
                        ${reasons.slice(0, 3).map(reason => 
                            `<div class="match-reason">${reason}</div>`
                        ).join('')}
                    </div>
                    ` : ''}
                    
                    <div class="row profile-details">
                        <div class="col s6">
                            <p class="cz-regular">
                                <strong>Goal:</strong> ${formatGoal(user.relationship_goal)}
                            </p>
                        </div>
                        <div class="col s6">
                            <p class="cz-regular">
                                <strong>Profession:</strong> ${user.profession || 'Not specified'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };
    
    // Handle like action
    const handleLike = async () => {
        if (currentMatches.length === 0) return;
        
        const targetUser = currentMatches[currentMatchIndex].user;
        
        try {
            const response = await fetch('http://localhost:3000/api/swipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    targetId: targetUser.id,
                    action: 'like'
                })
            });
            
            const result = await response.json();
            
            if (result.match) {
                showMatchModal(targetUser);
                // Send push notification
                await sendMatchNotification(targetUser);
            }
            
            // Move to next match
            currentMatchIndex++;
            if (currentMatchIndex < currentMatches.length) {
                displayCurrentMatch();
            } else {
                showEmptyState($matchesContainer);
            }
        } catch (error) {
            console.error('Error liking:', error);
            M.toast({ html: 'Error processing like. Please try again.' });
        }
    };
    
    // Handle pass action
    const handlePass = async () => {
        if (currentMatches.length === 0) return;
        
        const targetUser = currentMatches[currentMatchIndex].user;
        
        try {
            await fetch('http://localhost:3000/api/swipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    targetId: targetUser.id,
                    action: 'pass'
                })
            });
            
            // Move to next match
            currentMatchIndex++;
            if (currentMatchIndex < currentMatches.length) {
                displayCurrentMatch();
            } else {
                showEmptyState($matchesContainer);
            }
        } catch (error) {
            console.error('Error passing:', error);
        }
    };
    
    // Show match modal
    const showMatchModal = (targetUser) => {
        $('#matchUserName').text(targetUser.full_name || 'Anonymous');
        $('#chatNowBtn').attr('href', `messages.html?matchId=${targetUser.id}`);
        
        // Set avatar in modal
        const avatarInitial = targetUser.full_name?.[0]?.toUpperCase() || '?';
        const avatarColor = getAvatarColor(targetUser.id);
        $('#matchUserIcon').parent().css('background', avatarColor);
        $('#matchUserIcon').text(avatarInitial);
        
        const modalInstance = M.Modal.getInstance($matchModal[0]);
        if (!modalInstance) {
            M.Modal.init($matchModal[0]).open();
        } else {
            modalInstance.open();
        }
    };
    
    // Send match notification
    const sendMatchNotification = async (targetUser) => {
        try {
            await fetch('http://localhost:3000/api/notify-match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    matchUserId: targetUser.id,
                    matchName: currentUser.full_name || 'Someone'
                })
            });
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    };
    
    // Show empty state
    const showEmptyState = ($container, title = 'No more matches right now', message = 'Check back later or try manual search') => {
        $container.html(`
            <div class="empty-state">
                <i class="material-icons">favorite_border</i>
                <h5 class="cz-bold">${title}</h5>
                <p class="cz-regular">${message}</p>
                ${currentMode === 'algorithm' ? `
                <button class="btn gold-bg cz-bold" onclick="$(this).closest('.matches-section').siblings('[id$=Section]').find('button').click()">
                    <i class="material-icons left">search</i>Try Manual Search
                </button>
                ` : ''}
            </div>
        `);
    };
    
    // Show error state
    const showErrorState = ($container, message) => {
        $container.html(`
            <div class="empty-state">
                <i class="material-icons">error</i>
                <h5 class="cz-bold">Something went wrong</h5>
                <p class="cz-regular">${message}</p>
                <button class="btn emerald-bg cz-bold" onclick="location.reload()">
                    <i class="material-icons left">refresh</i>Try Again
                </button>
            </div>
        `);
    };
    
    // Initialize hobby filters
    const initializeHobbyFilters = () => {
        const hobbies = [
            'Reading', 'Travel', 'Sports', 'Music', 'Cooking',
            'Movies', 'Gaming', 'Art', 'Dancing', 'Photography',
            'Writing', 'Fishing', 'Hiking', 'Shopping', 'Gardening',
            'Technology', 'Business', 'Fashion', 'Food', 'Nature'
        ];
        
        $hobbyFilters.empty();
        hobbies.forEach(hobby => {
            $hobbyFilters.append(`
                <p>
                    <label class="cz-regular">
                        <input type="checkbox" class="filled-in filter-hobby" value="${hobby}" />
                        <span>${hobby}</span>
                    </label>
                </p>
            `);
        });
        
        // Limit to 3 selected hobbies
        $('.filter-hobby').on('change', function() {
            const checkedCount = $('.filter-hobby:checked').length;
            if (checkedCount > 3) {
                $(this).prop('checked', false);
                M.toast({ html: 'Please select up to 3 hobbies only' });
            }
        });
    };
    
    // Clear all filters
    const clearFilters = () => {
        $('#filterLGA').val('');
        $('#filterMinAge').val('');
        $('#filterMaxAge').val('');
        $('#filterGoal').val('');
        $('.filter-hobby').prop('checked', false);
        M.updateTextFields();
    };
    
    // Helper functions
    const calculateAge = (dob) => {
        if (!dob) return '--';
        const birthDate = new Date(dob);
        const diff = Date.now() - birthDate.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };
    
    const formatGoal = (goal) => {
        const goals = {
            'marriage': 'Marriage',
            'serious': 'Serious Relationship',
            'dating': 'Casual Dating',
            'friendship': 'Friendship',
            'single_parent': 'Single Parent'
        };
        return goals[goal] || goal || 'Not specified';
    };
    
    const truncateText = (text, maxLength) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };
    
    const getAvatarColor = (userId) => {
        const colors = [
            '#10b981', '#047857', '#f59e0b', '#d97706',
            '#8b5cf6', '#7c3aed', '#ef4444', '#dc2626',
            '#3b82f6', '#1d4ed8', '#ec4899', '#db2777'
        ];
        const hash = userId ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
        return colors[hash % colors.length];
    };
    
    // Initialize the page
    await initializePage();
});


