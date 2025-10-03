// Wedding Website JavaScript

// Configuration
// Removed unused Formspree constant since the app uses Netlify functions + EmailJS

// EmailJS Configuration (loaded from Netlify env via function)
// Helper to mask values in logs
const _mask = (s) => (s && s.length > 6 ? `${s.slice(0,3)}...${s.slice(-3)}` : s || '');
let EMAILJS_PUBLIC_KEY = '';
let EMAILJS_SERVICE_ID = '';
let EMAILJS_TEMPLATE_ID = '';

async function loadEmailJsConfig() {
    try {
        const res = await fetch('/.netlify/functions/get-emailjs-config');
        if (!res.ok) {
            console.error('[EmailJS] Failed to load config from function', { status: res.status });
            return;
        }
        const cfg = await res.json();
        EMAILJS_PUBLIC_KEY = cfg.publicKey || '';
        EMAILJS_SERVICE_ID = cfg.serviceId || '';
        EMAILJS_TEMPLATE_ID = cfg.templateId || '';
        console.info('[EmailJS] Config loaded', {
            hasPublicKey: !!EMAILJS_PUBLIC_KEY,
            serviceId: EMAILJS_SERVICE_ID,
            templateId: EMAILJS_TEMPLATE_ID,
        });
    } catch (e) {
        console.error('[EmailJS] Error fetching config from function', e);
    }
}

// API Configuration
const API_BASE = '/.netlify/functions';

const _p = ["UGFzdGE=","QUxhVmk=","bnRvbg=="]; 
const _s = 'wedding_auth_token';
const _getAuth = () => atob(_p[0]) + atob(_p[1]) + atob(_p[2]);

// Initialize the website
document.addEventListener('DOMContentLoaded', async function() {
    // Load EmailJS config then init
    await loadEmailJsConfig();
    if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY) {
        try {
            emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
            console.info('[EmailJS] Initialized with public key', _mask(EMAILJS_PUBLIC_KEY));
        } catch (e) {
            console.error('[EmailJS] Init failed:', e);
        }
    } else {
        if (typeof emailjs === 'undefined') {
            console.error('[EmailJS] SDK not loaded on page');
        }
        if (!EMAILJS_PUBLIC_KEY) {
            console.warn('[EmailJS] Public key missing; emails will not be sent');
        }
    }
    
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
    const guestNameInput = document.getElementById('guestName');

    // Clear the selected flag whenever the user types/edits the field
    guestNameInput.addEventListener('input', () => {
        delete guestNameInput.dataset.selected;
    });

    // Handle form submission
    rsvpForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Enforce selection from suggestions by checking the data-selected flag
        if (guestNameInput.dataset.selected !== 'true') {
            showRSVPError('Please select your name from the dropdown suggestions.');
            guestNameInput.focus();
            return;
        }

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
        // Mark as selected to enforce dropdown usage
        guestNameInput.dataset.selected = 'true';
        hideSuggestions();
        
        // Store max guests for validation later
        guestNameInput.dataset.maxGuests = guest.max_guests;
        guestNameInput.dataset.partnerName = guest.partner_name || '';
        guestNameInput.dataset.tier = guest.tier || '';
        guestNameInput.dataset.invitationDate = guest.invitation_date || '';
        
        // Also set hidden input for partner name so it is included in FormData
        const partnerNameHidden = document.getElementById('partnerNameInput');
        if (partnerNameHidden) {
            partnerNameHidden.value = guest.partner_name || '';
        }
        
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

    // Clear hidden partner name field
    const partnerNameHidden = document.getElementById('partnerNameInput');
    if (partnerNameHidden) {
        partnerNameHidden.value = '';
    }
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
        
        // Hide partner attendance options for each event and clear selected radios
        events.forEach(event => {
            const partnerEventSection = document.getElementById(`${event}-partner-section`);
            if (partnerEventSection) {
                partnerEventSection.style.display = 'none';
            }
            const yes = document.getElementById(`${event}-partner-attending-yes`);
            const no = document.getElementById(`${event}-partner-attending-no`);
            if (yes) yes.checked = false;
            if (no) no.checked = false;
        });
    }
}


