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
        const typeA = userA.connectionType || 'native';
        const typeB = userB.connectionType || 'native';

        // Both are Akwa Ibom natives
        if (typeA === 'native' && typeB === 'native') {
            if (userA.lga === userB.lga) {
                return 100; // Same LGA - strongest connection
            }

            // Check if LGAs are adjacent
            if (this.areLGAsAdjacent(userA.lga, userB.lga)) {
                return 85; // Neighboring LGAs
            }

            // Same senatorial district
            if (this.getSenatorialDistrict(userA.lga) === this.getSenatorialDistrict(userB.lga)) {
                return 70; // Same district
            }

            return 50; // Both from AKS but different areas
        }

        // One native, one non-native
        if ((typeA === 'native' && typeB !== 'native') ||
            (typeA !== 'native' && typeB === 'native')) {

            const native = typeA === 'native' ? userA : userB;
            const nonNative = typeA !== 'native' ? userA : userB;

            // Non-native lives in native's LGA
            if (nonNative.currentLga === native.lga) {
                return 80; // Strong local connection
            }

            // Non-native lives in Akwa Ibom
            if (nonNative.currentLga && nonNative.currentLga !== 'outside_nigeria' &&
                nonNative.currentLga !== 'other_nigeria') {
                return 65; // Both in Akwa Ibom
            }

            // Cultural interest match
            if (nonNative.connectionReason && this.checkCulturalInterest(nonNative.connectionReason, native)) {
                return 60; // Cultural connection
            }

            return 40; // Basic connection
        }

        // Both non-natives
        if (typeA !== 'native' && typeB !== 'native') {
            // Both live in Akwa Ibom
            if (userA.currentLga && userB.currentLga &&
                userA.currentLga !== 'outside_nigeria' &&
                userB.currentLga !== 'outside_nigeria') {

                if (userA.currentLga === userB.currentLga) {
                    return 75; // Live in same LGA
                }

                if (userA.city === userB.city) {
                    return 65; // Live in same city
                }

                return 50; // Both in AKS but different places
            }

            // Both outside but interested
            if (userA.connectionReason && userB.connectionReason) {
                const interestScore = this.calculateInterestSimilarity(
                    userA.connectionReason,
                    userB.connectionReason
                );
                return 40 + (interestScore * 0.6); // Up to 100
            }

            return 30; // Basic non-native connection
        }

        return 25; // Fallback
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

    // Helper methods for the matching algorithm
areLGAsAdjacent(lga1, lga2) {
    // Define adjacency clusters (simplified)
    const clusters = {
        'uyo': ['ibesikpo', 'nsit', 'nsit-atai', 'nsit-ubium', 'etinan'],
        'ikot ekpene': ['essien udim', 'obot akara', 'ini', 'ikono'],
        'eket': ['esit eket', 'onna', 'mkpat enin', 'ikai', 'etim ekpo'],
        'oron': ['udung uko', 'urue offong/oruko', 'okobo', 'mbo']
    };
    
    for (const [key, adjacent] of Object.entries(clusters)) {
        if ((lga1 === key && adjacent.includes(lga2)) || 
            (lga2 === key && adjacent.includes(lga1))) {
            return true;
        }
    }
    
    return false;
}

getSenatorialDistrict(lga) {
    // Simplified district mapping
    const districts = {
        'uyo': 'uyo', 'ibesikpo': 'uyo', 'nsit': 'uyo', 'nsit-atai': 'uyo', 
        'nsit-ubium': 'uyo', 'etinan': 'uyo', 'iburua': 'uyo',
        'eket': 'eket', 'esit eket': 'eket', 'onna': 'eket', 'mkpat enin': 'eket',
        'ikai': 'eket', 'etim ekpo': 'eket',
        'ikot ekpene': 'ikot ekpene', 'essien udim': 'ikot ekpene', 
        'obot akara': 'ikot ekpene', 'ini': 'ikot ekpene', 'ikono': 'ikot ekpene',
        'oron': 'oron', 'udung uko': 'oron', 'urue offong/oruko': 'oron',
        'okobo': 'oron', 'mbo': 'oron'
    };
    
    return districts[lga] || 'other';
}

checkCulturalInterest(reason, nativeUser) {
    if (!reason || !nativeUser) return false;
    
    const keywords = reason.toLowerCase().split(/\W+/);
    const culturalTerms = ['culture', 'tradition', 'heritage', 'roots', 'ibibio', 
                          'annang', 'orok', 'ibeno', 'akwa', 'ibom'];
    
    return keywords.some(keyword => 
        culturalTerms.includes(keyword) || 
        nativeUser.hometown?.toLowerCase().includes(keyword) ||
        nativeUser.lga?.toLowerCase().includes(keyword)
    );
}

calculateInterestSimilarity(reason1, reason2) {
    if (!reason1 || !reason2) return 0;
    
    const words1 = new Set(reason1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const words2 = new Set(reason2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const common = [...words1].filter(w => words2.has(w)).length;
    return (common / Math.max(words1.size, words2.size)) * 100;
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
            
            
            