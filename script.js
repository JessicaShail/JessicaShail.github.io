// Wedding Website JavaScript

// Configuration
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID"; // Replace with your Formspree endpoint

// API Configuration
const API_BASE = '/.netlify/functions';

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

// Collapsible functionality
function toggleCollapsible(eventId) {
    const content = document.getElementById(eventId + '-content');
    const header = content.previousElementSibling;
    
    // Toggle current collapsible only
    content.classList.toggle('active');
    header.classList.toggle('active');
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
    showSection('details');
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
    
    // Initialize autocomplete for guest names
    initializeGuestAutocomplete();
}

// Guest name autocomplete functionality
function initializeGuestAutocomplete() {
    const guestNameInput = document.getElementById('guestName');
    const suggestionsContainer = document.getElementById('guestSuggestions');
    let currentSuggestions = [];
    let selectedIndex = -1;
    let searchTimeout;

    // Handle input changes
    guestNameInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        // Clear previous timeout
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            hideSuggestions();
            // Hide tier info when input is cleared
            const tierInfo = document.getElementById('tier-info');
            if (tierInfo) {
                tierInfo.style.display = 'none';
            }
            // Hide RSVP form sections when input is cleared
            hideRSVPFormSections();
            // Clear guest names
            clearGuestNames();
            return;
        }
        
        // Debounce the search to avoid too many API calls
        searchTimeout = setTimeout(() => {
            searchGuests(query);
        }, 300);
    });

    // Handle keyboard navigation
    guestNameInput.addEventListener('keydown', function(e) {
        if (!suggestionsContainer.classList.contains('show')) {
            return;
        }
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
                highlightSuggestion();
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                highlightSuggestion();
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
                    selectSuggestion(currentSuggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                hideSuggestions();
                break;
        }
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!guestNameInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            hideSuggestions();
        }
    });

    // Search for guests
    async function searchGuests(query) {
        try {
            const response = await fetch(`${API_BASE}/get-guest-list?q=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch guest suggestions');
            }
            
            const data = await response.json();
            
            if (data.success && data.guests) {
                currentSuggestions = data.guests;
                displaySuggestions(data.guests);
            } else {
                displayNoSuggestions();
            }
        } catch (error) {
            console.error('Error fetching guest suggestions:', error);
            displayNoSuggestions();
        }
    }

    // Display suggestions
    function displaySuggestions(guests) {
        if (guests.length === 0) {
            displayNoSuggestions();
            return;
        }

        suggestionsContainer.innerHTML = guests.map((guest, index) => `
            <div class="suggestion-item" data-index="${index}" onclick="selectSuggestionByIndex(${index})">
                <div class="suggestion-name">${escapeHtml(guest.guest_name)}</div>
                <div class="suggestion-details">
                    ${guest.partner_name ? `With ${escapeHtml(guest.partner_name)}` : ''}
                </div>
            </div>
        `).join('');
        
        selectedIndex = -1;
        suggestionsContainer.classList.add('show');
    }

    // Display no suggestions message
    function displayNoSuggestions() {
        suggestionsContainer.innerHTML = '<div class="no-suggestions">No matching guests found</div>';
        suggestionsContainer.classList.add('show');
        currentSuggestions = [];
        selectedIndex = -1;
    }

    // Hide suggestions
    function hideSuggestions() {
        suggestionsContainer.classList.remove('show');
        selectedIndex = -1;
    }

    // Highlight selected suggestion
    function highlightSuggestion() {
        const items = suggestionsContainer.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('highlighted');
            } else {
                item.classList.remove('highlighted');
            }
        });
    }

    // Select a suggestion
    function selectSuggestion(guest) {
        guestNameInput.value = guest.guest_name;
        hideSuggestions();
        
        // Store max guests for validation later
        guestNameInput.dataset.maxGuests = guest.max_guests;
        guestNameInput.dataset.partnerName = guest.partner_name || '';
        guestNameInput.dataset.tier = guest.tier || '';
        guestNameInput.dataset.invitationDate = guest.invitation_date || '';
        
        // Populate guest names in RSVP sections
        populateGuestNames(guest.guest_name, guest.partner_name);
        
        // Show/hide partner section based on whether guest has a partner
        showPartnerSection(guest.partner_name);
        
        // Check and display tier information, and show RSVP sections if allowed
        const canRSVP = checkAndDisplayTierInfo(guest);
        
        // Show the RSVP form sections only if guest can RSVP (tier is available)
        if (canRSVP) {
            showRSVPFormSections();
        } else {
            hideRSVPFormSections();
        }
        
        // Focus on next input
        document.getElementById('email').focus();
    }

    // Global function to select suggestion by index (called from onclick)
    window.selectSuggestionByIndex = function(index) {
        if (index >= 0 && index < currentSuggestions.length) {
            selectSuggestion(currentSuggestions[index]);
        }
    };

    // Check tier availability and display information
    // Returns true if guest can RSVP, false if tier is not yet available
    function checkAndDisplayTierInfo(guest) {
        const tierInfo = document.getElementById('tier-info');
        const tierMessage = document.getElementById('tier-message');
        const tierDateSpan = document.getElementById('tier-date');
        
        if (!tierInfo || !tierMessage || !tierDateSpan) {
            return true; // Elements don't exist, assume can RSVP
        }
        
        const today = new Date();
        const invitationDate = guest.invitation_date ? new Date(guest.invitation_date) : null;
        
        if (invitationDate && today < invitationDate) {
            // Tier is not yet open - show tier info and don't allow RSVP
            const tierNumber = guest.tier || 'Unknown';
            const dateString = invitationDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            tierMessage.textContent = `You are on our Tier ${tierNumber} invitation list.`;
            tierDateSpan.textContent = dateString;
            tierInfo.style.display = 'block';
            return false; // Cannot RSVP yet
        } else {
            // Tier is open or no restriction - hide tier info and allow RSVP
            tierInfo.style.display = 'none';
            return true; // Can RSVP
        }
    }


}

// Show RSVP form sections when valid guest is selected
function showRSVPFormSections() {
    const rsvpFormSections = document.getElementById('rsvp-form-sections');
    if (rsvpFormSections) {
        rsvpFormSections.style.display = 'block';
    }
}

// Hide RSVP form sections when guest input is cleared
function hideRSVPFormSections() {
    const rsvpFormSections = document.getElementById('rsvp-form-sections');
    if (rsvpFormSections) {
        rsvpFormSections.style.display = 'none';
    }
}

// Populate guest names in all RSVP sections
function populateGuestNames(guestName, partnerName) {
    // Update main guest name in all events
    const events = ['mehndi', 'ceremony', 'reception'];
    events.forEach(event => {
        const guestNameElement = document.getElementById(`${event}-guest-name`);
        if (guestNameElement) {
            guestNameElement.textContent = guestName;
        }
        
        // Update partner name if applicable
        const partnerNameElement = document.getElementById(`${event}-partner-name`);
        if (partnerNameElement && partnerName) {
            partnerNameElement.textContent = partnerName;
        }
    });
}

// Clear guest names from all RSVP sections
function clearGuestNames() {
    const events = ['mehndi', 'ceremony', 'reception'];
    events.forEach(event => {
        const guestNameElement = document.getElementById(`${event}-guest-name`);
        if (guestNameElement) {
            guestNameElement.textContent = 'Guest Name';
        }
        
        const partnerNameElement = document.getElementById(`${event}-partner-name`);
        if (partnerNameElement) {
            partnerNameElement.textContent = 'Partner Name';
        }
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show or hide partner section based on guest selection
function showPartnerSection(partnerName) {
    const partnerSection = document.getElementById('partnerSection');
    const partnerNameElement = document.getElementById('partnerName');
    
    // Event-specific partner sections
    const events = ['mehndi', 'ceremony', 'reception'];
    
    if (partnerName && partnerName.trim()) {
        // Show partner section
        partnerSection.style.display = 'block';
        partnerNameElement.textContent = partnerName;
        
        // Show partner attendance options for each event
        events.forEach(event => {
            const partnerEventSection = document.getElementById(`${event}-partner-section`);
            
            if (partnerEventSection) {
                partnerEventSection.style.display = 'block';
            }
        });
    } else {
        // Hide partner section
        partnerSection.style.display = 'none';
        
        // Hide partner attendance options for each event
        events.forEach(event => {
            const partnerEventSection = document.getElementById(`${event}-partner-section`);
            const partnerAttendingCheckbox = document.getElementById(`${event}-partner-attending`);
            
            if (partnerEventSection) {
                partnerEventSection.style.display = 'none';
            }
            if (partnerAttendingCheckbox) {
                partnerAttendingCheckbox.checked = false;
            }
        });
    }
}



// API Helper Functions
async function submitRSVPToAPI(formData) {
    const response = await fetch(`${API_BASE}/submit-rsvp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(Object.fromEntries(formData))
    });
    
    const result = await response.json();
    
    if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
    }
    
    return result;
}

// Validate form before submission
function validateAndSubmitRSVP() {
    const form = document.getElementById('rsvpForm');
    const formData = new FormData(form);
    
    // Basic client-side validation
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
    
    // Check if at least one person is attending at least one event
    const mehndiAttending = formData.get('mehndi-attending');
    const ceremonyAttending = formData.get('ceremony-attending');
    const receptionAttending = formData.get('reception-attending');
    const mehndiPartnerAttending = formData.get('mehndi-partner-attending');
    const ceremonyPartnerAttending = formData.get('ceremony-partner-attending');
    const receptionPartnerAttending = formData.get('reception-partner-attending');
    
    const hasAnyAttendance = mehndiAttending === 'yes' || ceremonyAttending === 'yes' || receptionAttending === 'yes' ||
                            mehndiPartnerAttending === 'yes' || ceremonyPartnerAttending === 'yes' || receptionPartnerAttending === 'yes';
    
    if (!hasAnyAttendance) {
        showRSVPError('Please select attendance for at least one person at one event.');
        return;
    }
    
    // If basic validation passes, submit to API
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
        // Submit to API
        const result = await submitRSVPToAPI(formData);
        
        // Show success message with personalized greeting
        showRSVPSuccessWithMessage(result.message);
        
        // Reset form and hide partner sections
        form.reset();
        ['mehndi', 'ceremony', 'reception'].forEach(event => {
            const partnerSection = document.getElementById(`${event}-partner-section`);
            if (partnerSection) {
                partnerSection.style.display = 'none';
            }
        });
        
        // Hide main partner section
        const partnerSection = document.getElementById('partnerSection');
        if (partnerSection) {
            partnerSection.style.display = 'none';
        }
        
        // Hide RSVP form sections after successful submission
        hideRSVPFormSections();
        
        // Clear guest names after successful submission
        clearGuestNames();
        
    } catch (error) {
        console.error('RSVP submission error:', error);
        
        // Check for tier-specific error messages
        let errorMessage = error.message || 'There was an error submitting your RSVP. Please try again or contact us directly.';
        
        if (error.message && error.message.includes('not yet open for your invitation tier')) {
            // Show tier information panel if it exists
            const tierInfo = document.getElementById('tier-info');
            if (tierInfo) {
                tierInfo.style.display = 'block';
            }
        }
        
        showRSVPError(errorMessage);
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.innerHTML = 'Submit RSVP';
    }
}

function showRSVPSuccessWithMessage(message) {
    // Hide form and show success
    document.getElementById('rsvpForm').classList.add('hidden');
    const successDiv = document.getElementById('rsvpSuccess');
    
    // Update success message with personalized content
    const messageP = successDiv.querySelector('p');
    messageP.textContent = message;
    
    successDiv.classList.remove('hidden');
    
    // Scroll to success message
    successDiv.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
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
        showSection('details');
    }
});

// Handle initial page load with hash
window.addEventListener('load', function() {
    const hash = window.location.hash.substring(1);
    if (hash && ['details', 'rsvp'].includes(hash)) {
        showSection(hash);
    } else {
        showSection('details');
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