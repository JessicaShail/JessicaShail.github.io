// Wedding Website JavaScript

// Configuration
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID"; // Replace with your Formspree endpoint

// Guest List Configuration (encoded for basic security)
// To add guests: encode each name with btoa("Guest Name") and add to array
const _guestList = [
    "Sm9obiBTbWl0aA==", // John Smith
    "SmFuZSBEb2U=", // Jane Doe
    "TWljaGFlbCBKb2huc29u", // Michael Johnson
    "U2FyYWggV2lsc29u", // Sarah Wilson
    "RGF2aWQgQnJvd24=", // David Brown
    "RW1pbHkgRGF2aXM=", // Emily Davis
    "Q2hyaXMgTWlsbGVy", // Chris Miller
    "TGlzYSBHYXJjaWE=", // Lisa Garcia
    "TWF0dCBUYXlsb3I=", // Matt Taylor
    "QW1hbmRhIE1vb3Jl" // Amanda Moore
    // Add more encoded guest names here
    // To encode: console.log(btoa("Full Name"))
];

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
    
    // Handle form submission
    rsvpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        validateAndSubmitRSVP();
    });
}

// Function to toggle guest count visibility for each event
function toggleGuestCount(eventName) {
    const attendingSelect = document.getElementById(`${eventName}-attending`);
    const countGroup = document.getElementById(`${eventName}-count-group`);
    const guestSelect = document.getElementById(`${eventName}-guests`);
    
    if (attendingSelect.value === 'yes') {
        countGroup.style.display = 'block';
        countGroup.style.opacity = '1';
        guestSelect.required = true;
    } else {
        countGroup.style.display = 'none';
        countGroup.style.opacity = '0';
        guestSelect.required = false;
        guestSelect.value = '1'; // Reset to default
    }
}

// Guest List Validation Functions
function normalizeGuestName(name) {
    return name.toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' '); // Normalize spaces
}

function isGuestInvited(guestName) {
    const normalizedInput = normalizeGuestName(guestName);
    
    // Check against the guest list
    for (let encodedGuest of _guestList) {
        try {
            const decodedGuest = atob(encodedGuest);
            const normalizedGuest = normalizeGuestName(decodedGuest);
            
            // Exact match or partial match (for couples/families)
            if (normalizedGuest === normalizedInput || 
                normalizedGuest.includes(normalizedInput) ||
                normalizedInput.includes(normalizedGuest)) {
                return { 
                    isValid: true, 
                    matchedGuest: decodedGuest 
                };
            }
        } catch (e) {
            // Skip invalid encoded entries
            continue;
        }
    }
    
    return { isValid: false, matchedGuest: null };
}

function validateGuestList(guestName) {
    const validation = isGuestInvited(guestName);
    
    if (!validation.isValid) {
        return {
            isValid: false,
            message: `We couldn't find "${guestName}" on our guest list. Please check the spelling or contact us if you believe this is an error.`
        };
    }
    
    return {
        isValid: true,
        message: `Welcome, ${validation.matchedGuest}! We're excited to celebrate with you.`,
        matchedGuest: validation.matchedGuest
    };
}

// Validate form before submission
function validateAndSubmitRSVP() {
    const form = document.getElementById('rsvpForm');
    const formData = new FormData(form);
    
    // Basic validation
    const name = formData.get('guestName');
    const email = formData.get('email');
    
    if (!name || !email) {
        showRSVPError('Please fill in all required fields (Name and Email).');
        return;
    }
    
    if (!validateEmail(email)) {
        showRSVPError('Please enter a valid email address.');
        return;
    }
    
    // Guest list validation
    const guestValidation = validateGuestList(name);
    if (!guestValidation.isValid) {
        showRSVPError(guestValidation.message);
        return;
    }
    
    // Show welcome message for valid guests
    showGuestWelcomeMessage(guestValidation.message);
    
    // Check if at least one event is selected
    const mehndiAttending = formData.get('mehndi-attending');
    const ceremonyAttending = formData.get('ceremony-attending');
    const receptionAttending = formData.get('reception-attending');
    
    if (!mehndiAttending && !ceremonyAttending && !receptionAttending) {
        showRSVPError('Please select your attendance for at least one event.');
        return;
    }
    
    // If validation passes, submit the form
    submitRSVP();
}

async function submitRSVP() {
    const form = document.getElementById('rsvpForm');
    const submitButton = document.querySelector('.rsvp-submit');
    const formData = new FormData(form);
    
    // Disable submit button and show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    try {
        // Prepare comprehensive form data
        const rsvpData = {
            name: formData.get('guestName'),
            email: formData.get('email'),
            phone: formData.get('phone') || 'Not provided',
            events: {
                mehndi: {
                    attending: formData.get('mehndi-attending') || 'no',
                    guests: formData.get('mehndi-guests') || '0'
                },
                ceremony: {
                    attending: formData.get('ceremony-attending') || 'no',
                    guests: formData.get('ceremony-guests') || '0'
                },
                reception: {
                    attending: formData.get('reception-attending') || 'no',
                    guests: formData.get('reception-guests') || '0'
                }
            },
            dietary: formData.get('dietary') || 'None specified',
            message: formData.get('message') || 'No message',
            timestamp: new Date().toISOString()
        };
        
        // Log for development/testing
        console.log('RSVP Data:', rsvpData);
        
        // Submit to Netlify Forms (automatic when deployed on Netlify)
        await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString()
        });
        
        // Show success message
        showRSVPSuccess();
        
        // Reset form and hide guest count groups
        form.reset();
        ['mehndi', 'ceremony', 'reception'].forEach(event => {
            const countGroup = document.getElementById(`${event}-count-group`);
            if (countGroup) {
                countGroup.style.display = 'none';
                countGroup.style.opacity = '0';
            }
        });
        
    } catch (error) {
        console.error('RSVP submission error:', error);
        showRSVPError('There was an error submitting your RSVP. Please try again or contact us directly.');
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-heart"></i> Send RSVP';
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
    // Remove any existing messages
    const existingError = document.getElementById('rsvpError');
    const existingWelcome = document.getElementById('rsvpWelcome');
    if (existingError) existingError.remove();
    if (existingWelcome) existingWelcome.remove();
    
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.id = 'rsvpError';
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    
    const form = document.getElementById('rsvpForm');
    form.parentNode.insertBefore(errorDiv, form);
    
    errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
        if (errorDiv) {
            errorDiv.remove();
        }
    }, 8000);
}

function showGuestWelcomeMessage(message) {
    // Remove any existing messages
    const existingError = document.getElementById('rsvpError');
    const existingWelcome = document.getElementById('rsvpWelcome');
    if (existingError) existingError.remove();
    if (existingWelcome) existingWelcome.remove();
    
    // Create welcome message element
    const welcomeDiv = document.createElement('div');
    welcomeDiv.id = 'rsvpWelcome';
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.style.cssText = `
        background: linear-gradient(135deg, #DCD0A8, #FFF9E5);
        border: 1px solid #4A9782;
        color: #004030;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
    `;
    
    const form = document.getElementById('rsvpForm');
    form.parentNode.insertBefore(welcomeDiv, form);
    
    welcomeDiv.innerHTML = `<i class="fas fa-check-circle" style="color: #4A9782;"></i> ${message}`;
    welcomeDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Auto-hide after 6 seconds
    setTimeout(() => {
        if (welcomeDiv) {
            welcomeDiv.remove();
        }
    }, 6000);
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