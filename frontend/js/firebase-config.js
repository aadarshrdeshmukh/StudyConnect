// Firebase is already initialized in the HTML file via CDN
// This file is for additional Firebase utilities and helpers

// Wait for Firebase to be initialized
document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase is loaded
    if (typeof window.firebaseAuth !== 'undefined') {
        console.log('🔥 Firebase config utilities loaded');
        
        // Add any additional Firebase utility functions here
        window.FirebaseUtils = {
            // Check if user is authenticated
            isAuthenticated: () => {
                return window.firebaseAuth.currentUser !== null;
            },
            
            // Get current user info
            getCurrentUser: () => {
                return window.firebaseAuth.currentUser;
            },
            
            // Format user data for display
            formatUserData: (user) => {
                if (!user) return null;
                return {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified
                };
            },
            
            // Validate college email
            isValidCollegeEmail: (email) => {
                // Add your college domain validation here
                const collegeDomains = ['.edu.in', '.ac.in', '.edu', '.college.edu.in'];
                return collegeDomains.some(domain => email.endsWith(domain));
            }
        };
    } else {
        console.error('❌ Firebase not loaded properly');
    }
});

console.log('📝 Firebase config utilities script loaded');
