// Flexible Matching Algorithm for Akwa-Connect
class AkwaMatcher {
    constructor() {
        this.weights = {
            location: 0.3,      // 30%
            preferences: 0.25,   // 25%
            hobbies: 0.20,      // 20%
            demographics: 0.15,  // 15%
            bioSimilarity: 0.10  // 10%
        };
    }

    // Calculate compatibility score (0-100)
    calculateCompatibility(userA, userB) {
        let score = 0;
        let breakdown = {};
        
        // 1. Location Compatibility
        breakdown.location = this.calculateLocationScore(userA, userB);
        score += breakdown.location * this.weights.location;
        
        // 2. Preference Matching
        breakdown.preferences = this.calculatePreferenceScore(userA, userB);
        score += breakdown.preferences * this.weights.preferences;
        
        // 3. Hobbies Matching
        breakdown.hobbies = this.calculateHobbyScore(userA, userB);
        score += breakdown.hobbies * this.weights.hobbies;
        
        // 4. Demographic Compatibility
        breakdown.demographics = this.calculateDemographicScore(userA, userB);
        score += breakdown.demographics * this.weights.demographics;
        
        // 5. Bio Similarity
        breakdown.bioSimilarity = this.calculateBioSimilarity(userA, userB);
        score += breakdown.bioSimilarity * this.weights.bioSimilarity;
        
        // 6. Dealbreaker Checks
        if (this.hasDealbreaker(userA, userB)) {
            return {
                totalScore: 0,
                breakdown,
                compatible: false,
                reasons: ["Dealbreaker detected"]
            };
        }
        
        // 7. Special Bonuses
        const bonuses = this.calculateSpecialBonuses(userA, userB);
        score = Math.min(score + bonuses, 100);
        
        return {
            totalScore: Math.round(score),
            breakdown,
            compatible: score >= 40, // Minimum threshold
            reasons: this.generateMatchReasons(userA, userB, breakdown)
        };
    }

    // 1. Location-based scoring
    calculateLocationScore(userA, userB) {
        if (userA.lga === userB.lga) {
            return 100; // Same LGA
        }
        
        // Define proximity clusters
        const clusters = {
            "uyo": ["uyo", "ibesikpo", "nsit", "ibesikpo asutan"],
            "eket": ["eket", "esit eket", "onna"],
            "ikot": ["ikot ekpene", "essien udim", "obot akara"]
        };
        
        // Check if in same cluster
        for (const [key, areas] of Object.entries(clusters)) {
            if (areas.includes(userA.lga.toLowerCase()) && 
                areas.includes(userB.lga.toLowerCase())) {
                return 75; // Same region
            }
        }
        
        // Different but within Akwa Ibom
        if (userA.lga && userB.lga) {
            return 50;
        }
        
        return 25; // One location missing
    }

    // 2. Preference-based scoring (flexible)
    calculatePreferenceScore(userA, userB) {
        let score = 0;
        
        // Age preference check
        const aPrefersB = this.checkAgePreference(userA, userB);
        const bPrefersA = this.checkAgePreference(userB, userA);
        
        if (aPrefersB && bPrefersA) score += 40;
        else if (aPrefersB || bPrefersA) score += 20;
        
        // Relationship goal alignment
        const goalAlignment = this.checkGoalAlignment(userA.relationshipGoal, userB.relationshipGoal);
        score += goalAlignment * 30;
        
        // Text preferences similarity (basic NLP)
        if (userA.preferences && userB.preferences) {
            const prefSimilarity = this.calculateTextSimilarity(
                userA.preferences.toLowerCase(),
                userB.preferences.toLowerCase()
            );
            score += prefSimilarity * 30;
        }
        
        return Math.min(score, 100);
    }

    // 3. Hobby matching
    calculateHobbyScore(userA, userB) {
        if (!userA.hobbies || !userB.hobbies || 
            userA.hobbies.length === 0 || userB.hobbies.length === 0) {
            return 50; // Neutral if no hobbies specified
        }
        
        const commonHobbies = userA.hobbies.filter(hobby => 
            userB.hobbies.includes(hobby)
        );
        
        const totalHobbies = new Set([...userA.hobbies, ...userB.hobbies]).size;
        const similarity = (commonHobbies.length / totalHobbies) * 100;
        
        // Bonus for having hobbies at all
        return Math.min(similarity + 10, 100);
    }

    // 4. Demographic compatibility
    calculateDemographicScore(userA, userB) {
        let score = 50; // Start at neutral
        
        // Age gap scoring (more flexible)
        const ageDiff = Math.abs(this.calculateAge(userA.dob) - this.calculateAge(userB.dob));
        if (ageDiff <= 2) score += 30;
        else if (ageDiff <= 5) score += 20;
        else if (ageDiff <= 10) score += 10;
        else if (ageDiff <= 15) score += 5;
        
        // Education level (if provided)
        if (userA.education && userB.education) {
            const educationLevels = ["secondary", "diploma", "bachelors", "masters", "phd"];
            const aIndex = educationLevels.indexOf(userA.education.toLowerCase());
            const bIndex = educationLevels.indexOf(userB.education.toLowerCase());
            
            if (aIndex !== -1 && bIndex !== -1) {
                const diff = Math.abs(aIndex - bIndex);
                if (diff === 0) score += 20;
                else if (diff === 1) score += 10;
            }
        }
        
        // Disability awareness bonus (if both mention disabilities)
        if (userA.disabilityDesc && userB.disabilityDesc) {
            score += 15; // Shared understanding
        }
        
        return Math.min(score, 100);
    }

    // 5. Bio similarity
    calculateBioSimilarity(userA, userB) {
        if (!userA.bio || !userB.bio) return 50;
        
        // Simple keyword matching for bio similarity
        const aWords = new Set(userA.bio.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        const bWords = new Set(userB.bio.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        
        const commonWords = [...aWords].filter(word => bWords.has(word));
        
        if (commonWords.length === 0) return 30;
        
        const similarity = (commonWords.length / Math.min(aWords.size, bWords.size)) * 100;
        return Math.min(similarity, 100);
    }

    // Dealbreaker system
    hasDealbreaker(userA, userB) {
        // Age outside preference range (both ways)
        if (!this.checkAgePreference(userA, userB) || 
            !this.checkAgePreference(userB, userA)) {
            return true;
        }
        
        // Completely incompatible relationship goals
        const incompatiblePairs = [
            ["marriage", "casual dating"],
            ["single_parent", "no kids ever"]
        ];
        
        const aGoal = userA.relationshipGoal?.toLowerCase();
        const bGoal = userB.relationshipGoal?.toLowerCase();
        
        for (const pair of incompatiblePairs) {
            if ((pair[0] === aGoal && pair[1] === bGoal) ||
                (pair[1] === aGoal && pair[0] === bGoal)) {
                return true;
            }
        }
        
        return false;
    }

    // Special bonuses for target groups
    calculateSpecialBonuses(userA, userB) {
        let bonus = 0;
        
        // Academic community bonus
        if ((userA.profession?.toLowerCase().includes('student') || 
             userA.profession?.toLowerCase().includes('lecturer')) &&
            (userB.profession?.toLowerCase().includes('student') || 
             userB.profession?.toLowerCase().includes('lecturer'))) {
            bonus += 15;
        }
        
        // Single parent bonus
        if (userA.relationshipGoal === 'single_parent' && 
            userB.relationshipGoal === 'single_parent') {
            bonus += 20;
        }
        
        // Professional bonus (both 25-40)
        const aAge = this.calculateAge(userA.dob);
        const bAge = this.calculateAge(userB.dob);
        if (aAge >= 25 && aAge <= 40 && bAge >= 25 && bAge <= 40) {
            bonus += 10;
        }
        
        return bonus;
    }

    // Helper functions
    calculateAge(dob) {
        if (!dob) return 25; // Default
        const birthDate = new Date(dob);
        const diff = Date.now() - birthDate.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }

    checkAgePreference(user, target) {
        const targetAge = this.calculateAge(target.dob);
        const minAge = user.minAgePreference || 25;
        const maxAge = user.maxAgePreference || 40;
        return targetAge >= minAge && targetAge <= maxAge;
    }

    checkGoalAlignment(goalA, goalB) {
        if (!goalA || !goalB) return 0.5;
        
        const compatibleGoals = {
            "marriage": ["marriage", "serious relationship"],
            "serious relationship": ["marriage", "serious relationship", "single_parent"],
            "casual dating": ["casual dating", "friendship"],
            "friendship": ["friendship", "casual dating"],
            "single_parent": ["single_parent", "serious relationship"]
        };
        
        const aGoals = compatibleGoals[goalA.toLowerCase()] || [];
        if (aGoals.includes(goalB.toLowerCase())) {
            return 1.0;
        }
        return 0.3;
    }

    calculateTextSimilarity(text1, text2) {
        // Simple word overlap
        const words1 = new Set(text1.split(/\W+/).filter(w => w.length > 3));
        const words2 = new Set(text2.split(/\W+/).filter(w => w.length > 3));
        
        if (words1.size === 0 || words2.size === 0) return 0;
        
        const common = [...words1].filter(w => words2.has(w)).length;
        return common / Math.min(words1.size, words2.size);
    }

    generateMatchReasons(userA, userB, breakdown) {
        const reasons = [];
        
        if (breakdown.location > 80) {
            reasons.push("You're in the same LGA");
        } else if (breakdown.location > 60) {
            reasons.push("You're in nearby areas");
        }
        
        const commonHobbies = userA.hobbies?.filter(h => 
            userB.hobbies?.includes(h)
        );
        if (commonHobbies?.length > 0) {
            reasons.push(`Share ${commonHobbies.length} hobbies: ${commonHobbies.join(', ')}`);
        }
        
        if (breakdown.preferences > 70) {
            reasons.push("Similar relationship goals");
        }
        
        // Add age compatibility
        const ageDiff = Math.abs(this.calculateAge(userA.dob) - this.calculateAge(userB.dob));
        if (ageDiff <= 3) {
            reasons.push("Similar age range");
        }
        
        // Special group reasons
        if (userA.relationshipGoal === 'single_parent' && 
            userB.relationshipGoal === 'single_parent') {
            reasons.push("Both single parents - shared experience");
        }
        
        return reasons;
    }

    // Manual matching function
    findManualMatches(userId, allUsers, filters = {}) {
        const currentUser = allUsers.find(u => u.id === userId);
        if (!currentUser) return [];
        
        let filteredUsers = allUsers.filter(u => 
            u.id !== userId && 
            !currentUser.blockedUsers?.includes(u.id)
        );
        
        // Apply filters
        if (filters.lga) {
            filteredUsers = filteredUsers.filter(u => u.lga === filters.lga);
        }
        
        if (filters.minAge) {
            filteredUsers = filteredUsers.filter(u => 
                this.calculateAge(u.dob) >= filters.minAge
            );
        }
        
        if (filters.maxAge) {
            filteredUsers = filteredUsers.filter(u => 
                this.calculateAge(u.dob) <= filters.maxAge
            );
        }
        
        if (filters.hobbies?.length > 0) {
            filteredUsers = filteredUsers.filter(u =>
                u.hobbies?.some(h => filters.hobbies.includes(h))
            );
        }
        
        // Score each filtered user
        const scoredMatches = filteredUsers.map(user => {
            const compatibility = this.calculateCompatibility(currentUser, user);
            return {
                user,
                score: compatibility.totalScore,
                reasons: compatibility.reasons,
                breakdown: compatibility.breakdown
            };
        });
        
        // Sort by score
        return scoredMatches.sort((a, b) => b.score - a.score);
    }
}

// Export for use in other files
window.AkwaMatcher = AkwaMatcher;
            
            
            