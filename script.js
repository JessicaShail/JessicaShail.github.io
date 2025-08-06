// Wedding Website JavaScript

// Configuration
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID"; // Replace with your Formspree endpoint

const _p = ["UGFzdGE=","QUxhVmk=","bnRvbg=="];
const _s = 'wedding_auth_token';
const _getAuth = () => atob(_p[0]) + atob(_p[1]) + atob(_p[2]);

// Initialize the website
document.addEventListener('DOMContentLoaded', function() {
    initializeWebsite();
});

function initializeWebsite() {
    // Check if password has been entered previously
    const authToken = sessionStorage.getItem(_s);
    const isAuthenticated = authToken && _isValidSession(authToken);
    
    if (isAuthenticated) {
        hidePasswordModal();
    } else {
        showPasswordModal();
        // Clear any invalid session
        sessionStorage.removeItem(_s);
    }
    
    // Initialize form handlers
    initializeRSVPForm();
    initializeNavigation();
}

// Validate session token (basic time-based validation)
function _isValidSession(token) {
    try {
        const timestamp = parseInt(atob(token));
        const now = Date.now();
        const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
        return (now - timestamp) < sessionDuration;
    } catch (e) {
        return false;
    }
}

// Password Protection Functions
function showPasswordModal() {
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('mainContent').classList.add('hidden');
    
    // Focus on password input
    document.getElementById('passwordInput').focus();
    
    // Handle Enter key in password input
    document.getElementById('passwordInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });
}

function hidePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('mainContent').classList.remove('hidden');
    
    // Show default section
    showSection('events');
}

function checkPassword() {
    const enteredPassword = document.getElementById('passwordInput').value;
    const errorElement = document.getElementById('passwordError');
    
    // Use obfuscated password check with additional validation
    const validPass = _validateAccess(enteredPassword);
    
    if (validPass) {
        // Correct password
        sessionStorage.setItem(_s, btoa(Date.now().toString()));
        hidePasswordModal();
        clearPasswordError();
    } else {
        // Incorrect password
        showPasswordError('Incorrect password. Please try again.');
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
        
        // Add small delay to prevent rapid brute force attempts
        setTimeout(() => {
            document.getElementById('passwordInput').disabled = false;
        }, 1000);
        document.getElementById('passwordInput').disabled = true;
    }
}

// Obfuscated password validation function
function _validateAccess(input) {
    const expected = _getAuth();
    let result = true;
    
    // Constant-time comparison to prevent timing attacks
    if (input.length !== expected.length) {
        result = false;
    }
    
    for (let i = 0; i < Math.max(input.length, expected.length); i++) {
        if (input.charCodeAt(i) !== expected.charCodeAt(i)) {
            result = false;
        }
    }
    
    return result;
}

function showPasswordError(message) {
    const errorElement = document.getElementById('passwordError');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function clearPasswordError() {
    const errorElement = document.getElementById('passwordError');
    errorElement.textContent = '';
    errorElement.style.display = 'none';
}

// Navigation Functions
function initializeNavigation() {
    // Add click handlers to navigation links
    const navLinks = document.querySelectorAll('.navigation a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('href').substring(1);
            showSection(targetSection);
            
            // Update active navigation item
            updateActiveNavigation(this);
        });
    });
}

function showSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update URL hash without triggering scroll
    history.replaceState(null, null, '#' + sectionId);
    
    // Scroll to position the navigation bar at the top
    const navigation = document.querySelector('.navigation');
    if (navigation) {
        const navigationTop = navigation.offsetTop;
        window.scrollTo({ 
            top: navigationTop, 
            behavior: 'smooth' 
        });
    }
}

function updateActiveNavigation(activeLink) {
    // Remove active class from all nav links
    const navLinks = document.querySelectorAll('.navigation a');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to clicked link
    activeLink.classList.add('active');
}

// RSVP Form Functions
function initializeRSVPForm() {
    const rsvpForm = document.getElementById('rsvpForm');
    const attendanceSelect = document.getElementById('attendance');
    const guestCountGroup = document.getElementById('guestCountGroup');
    
    // Show/hide guest count based on attendance
    attendanceSelect.addEventListener('change', function() {
        if (this.value === 'yes') {
            guestCountGroup.style.display = 'block';
            document.getElementById('guestCount').required = true;
        } else if (this.value === 'no') {
            guestCountGroup.style.display = 'none';
            document.getElementById('guestCount').required = false;
        }
    });
    
    // Handle form submission
    rsvpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        submitRSVP();
    });
}

async function submitRSVP() {
    const form = document.getElementById('rsvpForm');
    const submitButton = document.querySelector('.rsvp-submit');
    const formData = new FormData(form);
    
    // Disable submit button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    
    try {
        // Prepare form data
        const rsvpData = {
            name: formData.get('guestName'),
            email: formData.get('email'),
            attendance: formData.get('attendance'),
            guestCount: formData.get('guestCount') || '1',
            dietary: formData.get('dietary') || 'None',
            message: formData.get('message') || 'No message',
            timestamp: new Date().toISOString()
        };
        
        // For development/testing - log to console
        console.log('RSVP Data:', rsvpData);
        
        // In a real implementation, you would send this data to your backend
        // For now, we'll simulate a successful submission
        await simulateFormSubmission(rsvpData);
        
        // Show success message
        showRSVPSuccess();
        
        // Reset form
        form.reset();
        document.getElementById('guestCountGroup').style.display = 'none';
        
    } catch (error) {
        console.error('RSVP submission error:', error);
        showRSVPError('There was an error submitting your RSVP. Please try again or contact us directly.');
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = 'Send RSVP';
    }
}

// Simulate form submission (replace with real API call)
function simulateFormSubmission(data) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate 90% success rate
            if (Math.random() > 0.1) {
                resolve(data);
            } else {
                reject(new Error('Simulated network error'));
            }
        }, 1500);
    });
}

function showRSVPSuccess() {
    document.getElementById('rsvpForm').classList.add('hidden');
    document.getElementById('rsvpSuccess').classList.remove('hidden');
    
    // Scroll to success message
    document.getElementById('rsvpSuccess').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
    });
}

function showRSVPError(message) {
    alert(message); // In a real implementation, you'd show a proper error message
}

// Utility Functions
function formatDate(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return new Date(date).toLocaleDateString('en-US', options);
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', function(e) {
    const hash = window.location.hash.substring(1);
    if (hash) {
        showSection(hash);
    } else {
        showSection('events');
    }
});

// Handle initial page load with hash
window.addEventListener('load', function() {
    const hash = window.location.hash.substring(1);
    if (hash && ['events', 'mehndi', 'ceremony', 'reception', 'attire', 'rsvp'].includes(hash)) {
        showSection(hash);
    } else {
        showSection('events');
    }
});

// Smooth scrolling for anchor links
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#')) {
        const targetId = e.target.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            e.preventDefault();
            targetElement.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Add some interactive animations
function addScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.detail-card, .timeline-item, .location-card, .attire-card');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Initialize animations when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addScrollAnimations, 1000); // Delay to ensure everything is loaded
});

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkPassword,
        showSection,
        submitRSVP,
        validateEmail
    };
}