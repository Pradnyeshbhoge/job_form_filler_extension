// Content script for Job Application Form Filler
let formData = null;
let isFormDetected = false;
let isExtensionEnabled = true;

// Check if we're in a valid context
if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('Chrome extension context not available');
    // Exit gracefully
} else {
    console.log('Job Application Form Filler content script loaded');
    
    // Ensure autoFillForm function is available globally
    if (typeof window.autoFillForm === 'undefined') {
        console.log('Setting up autoFillForm function');
        window.autoFillForm = function() {
            console.log('Auto-fill function called (fallback)');
            // This will be replaced by the actual function definition
        };
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeFormDetection();
    } catch (error) {
        console.log('Error initializing form detection:', error.message);
    }
});

// Also run when the page is dynamically updated (SPA support)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        try {
            initializeFormDetection();
        } catch (error) {
            console.log('Error initializing form detection:', error.message);
        }
    });
} else {
    try {
        initializeFormDetection();
    } catch (error) {
        console.log('Error initializing form detection:', error.message);
    }
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateFormData') {
        formData = request.data;
        sendResponse({status: 'updated'});
    }
    
    if (request.action === 'autoFillFromContextMenu' || 
        request.action === 'autoFillFromKeyboard' ||
        request.action === 'dataUpdated' ||
        request.action === 'extensionToggled') {
        if (request.action === 'dataUpdated') {
            // Reload data if it was updated
            chrome.storage.sync.get(['profile', 'education', 'experience', 'skills'], function(result) {
                if (result.profile || result.education || result.experience || result.skills) {
                    formData = result;
                }
            });
        } else if (request.action === 'extensionToggled') {
            // Update extension enabled state
            const wasEnabled = isExtensionEnabled;
            isExtensionEnabled = request.enabled;
            console.log(`Extension ${isExtensionEnabled ? 'enabled' : 'disabled'}`);
            
            if (isExtensionEnabled && !wasEnabled) {
                // Extension was enabled - start monitoring
                startFormMonitoring();
                console.log('Form monitoring started');
            } else if (!isExtensionEnabled && wasEnabled) {
                // Extension was disabled - stop monitoring
                stopFormMonitoring();
                console.log('Form monitoring stopped');
                
                // Remove any existing prompts
                const prompt = document.getElementById('jaff-prompt');
                if (prompt) {
                    prompt.remove();
                    isFormDetected = false;
                }
            }
        } else {
            // Auto-fill the form
            window.autoFillForm();
        }
        sendResponse({status: 'processed'});
    }
});

function initializeFormDetection() {
    // Only run on web pages, not on Chrome's internal pages
    if (location.protocol === 'chrome:' || location.protocol === 'chrome-extension:' || location.protocol === 'about:') {
        return;
    }
    
    // Check if Chrome storage is available
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('Chrome storage not available');
        return;
    }
    
    // Load saved data and extension state
    chrome.storage.sync.get(['profile', 'education', 'experience', 'skills', 'extensionEnabled'], function(result) {
        if (result.profile || result.education || result.experience || result.skills) {
            formData = result;
        }
        
        // Set extension enabled state (default to true if not set)
        isExtensionEnabled = result.extensionEnabled !== undefined ? result.extensionEnabled : true;
        console.log(`Extension initialized with state: ${isExtensionEnabled ? 'enabled' : 'disabled'}`);
        
        // Only check for forms if extension is enabled
        if (isExtensionEnabled) {
            checkForForms();
        }
    });
    
    // Ensure autoFillForm function is available
    if (typeof window.autoFillForm === 'undefined') {
        console.log('Setting up autoFillForm function in initializeFormDetection');
        window.autoFillForm = function() {
            console.log('Auto-fill function called (fallback from init)');
            // This will be replaced by the actual function definition
        };
    }
    
    // Check for forms periodically (for dynamic content) - only if enabled
    let formCheckInterval = null;
    if (isExtensionEnabled) {
        formCheckInterval = setInterval(checkForForms, 2000);
    }
    
    // Check for forms when URL changes (SPA support)
    let lastUrl = location.href;
    let urlObserver = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            if (isExtensionEnabled) {
                setTimeout(checkForForms, 1000);
            }
        }
    });
    urlObserver.observe(document, {subtree: true, childList: true});
    
    // Store references for cleanup
    window.jaffInterval = formCheckInterval;
    window.jaffObserver = urlObserver;
}

// Function to start form monitoring
function startFormMonitoring() {
    if (window.jaffInterval) {
        clearInterval(window.jaffInterval);
    }
    
    window.jaffInterval = setInterval(checkForForms, 2000);
    console.log('Form monitoring interval started - extension is active');
}

// Function to stop form monitoring
function stopFormMonitoring() {
    if (window.jaffInterval) {
        clearInterval(window.jaffInterval);
        window.jaffInterval = null;
        console.log('Form monitoring interval stopped');
    }
    
    // Reset form detection state
    isFormDetected = false;
    
    // Clear any pending timeouts
    if (window.jaffTimeout) {
        clearTimeout(window.jaffTimeout);
        window.jaffTimeout = null;
    }
    
    // Log that monitoring is completely stopped
    console.log('Form monitoring completely stopped - extension is inactive');
    
    // Additional cleanup
    console.log('Extension is now completely inactive - no background processes running');
    
    // Complete extension shutdown
    console.log('=== EXTENSION COMPLETELY DISABLED ===');
    console.log('No more console messages will appear until re-enabled');
}

function checkForForms() {
    // Early return if extension is completely disabled
    if (!isExtensionEnabled) {
        return; // Silent return - no logging when disabled
    }
    
    if (!formData) {
        console.log('No form data available');
        return;
    }
    
    const forms = document.querySelectorAll('form');
    console.log('Found forms:', forms.length);
    
    if (forms.length > 0 && !isFormDetected) {
        console.log('Form detected, showing auto-fill prompt');
        isFormDetected = true;
        showAutoFillPrompt();
    } else if (forms.length === 0) {
        console.log('No forms found on this page');
    }
}

function showAutoFillPrompt() {
    // Remove existing prompt if any
    const existingPrompt = document.getElementById('jaff-prompt');
    if (existingPrompt) {
        existingPrompt.remove();
    }
    
    const prompt = document.createElement('div');
    prompt.id = 'jaff-prompt';
    prompt.innerHTML = `
        <div class="jaff-prompt-content">
            <div class="jaff-prompt-header">
                <span class="jaff-prompt-icon">🚀</span>
                <span class="jaff-prompt-title">Job Application Form Filler</span>
                <button class="jaff-prompt-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="jaff-prompt-body">
                <p>We detected a form on this page. Would you like to auto-fill it with your saved information?</p>
                <div class="jaff-prompt-actions">
                    <button class="jaff-prompt-btn jaff-prompt-btn-primary" id="jaff-auto-fill-btn">Auto-fill Form</button>
                    <button class="jaff-prompt-btn jaff-prompt-btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Not Now</button>
                </div>
            </div>
        </div>
    `;
    
    // Add event listener to the auto-fill button
    document.body.appendChild(prompt);
    
    const autoFillBtn = prompt.querySelector('#jaff-auto-fill-btn');
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', function() {
            console.log('Auto-fill button clicked');
            if (typeof window.autoFillForm === 'function') {
                window.autoFillForm();
            } else {
                console.error('autoFillForm function not available');
                showNotification('Auto-fill function not available. Please refresh the page.', 'error');
            }
        });
    }
    
    // Add styles
    if (!document.getElementById('jaff-styles')) {
        const styles = document.createElement('style');
        styles.id = 'jaff-styles';
        styles.textContent = `
            #jaff-prompt {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                border-radius: 8px;
                background: white;
                max-width: 350px;
                animation: jaff-slide-in 0.3s ease-out;
            }
            
            @keyframes jaff-slide-in {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .jaff-prompt-content {
                padding: 0;
            }
            
            .jaff-prompt-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                border-radius: 8px 8px 0 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .jaff-prompt-icon {
                font-size: 20px;
            }
            
            .jaff-prompt-title {
                font-weight: 600;
                flex: 1;
            }
            
            .jaff-prompt-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s;
            }
            
            .jaff-prompt-close:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .jaff-prompt-body {
                padding: 20px;
            }
            
            .jaff-prompt-body p {
                margin: 0 0 15px 0;
                color: #333;
                line-height: 1.5;
            }
            
            .jaff-prompt-actions {
                display: flex;
                gap: 10px;
            }
            
            .jaff-prompt-btn {
                padding: 10px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
                flex: 1;
            }
            
            .jaff-prompt-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .jaff-prompt-btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            
            .jaff-prompt-btn-secondary {
                background: #f8f9fa;
                color: #6c757d;
                border: 1px solid #dee2e6;
            }
            
            .jaff-prompt-btn-secondary:hover {
                background: #e9ecef;
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (prompt.parentElement) {
            prompt.remove();
        }
    }, 10000);
}

// Make autoFillForm function globally accessible
window.autoFillForm = function() {
    // Early return if extension is disabled
    if (!isExtensionEnabled) {
        console.log('Extension is disabled - auto-fill function blocked');
        return;
    }
    
    console.log('Auto-fill function called');
    console.log('Form data available:', formData);
    
    if (!formData) {
        showNotification('No saved data found. Please configure your profile first.', 'error');
        return;
    }
    
    try {
        const forms = document.querySelectorAll('form');
        console.log('Forms to fill:', forms.length);
        let filledFields = 0;
        
        forms.forEach((form, index) => {
            console.log(`Filling form ${index + 1}:`, form);
            filledFields += fillForm(form);
        });
        
        console.log(`Total fields filled: ${filledFields}`);
        
        if (filledFields > 0) {
            showNotification(`Successfully filled ${filledFields} fields!`, 'success');
            // Remove the prompt after successful fill
            const prompt = document.getElementById('jaff-prompt');
            if (prompt) prompt.remove();
        } else {
            showNotification('No matching fields found to fill.', 'info');
        }
    } catch (error) {
        console.error('Error auto-filling form:', error);
        showNotification('Error occurred while filling the form.', 'error');
    }
};

function fillForm(form) {
    let filledFields = 0;
    
    // Fill profile information
    if (formData.profile) {
        filledFields += fillProfileFields(form);
    }
    
    // Fill education information
    if (formData.education && formData.education.length > 0) {
        filledFields += fillEducationFields(form);
    }
    
    // Fill experience information
    if (formData.experience && formData.experience.length > 0) {
        filledFields += fillExperienceFields(form);
    }
    
    // Fill skills information
    if (formData.skills) {
        filledFields += fillSkillsFields(form);
    }
    
    return filledFields;
}

function fillProfileFields(form) {
    let filled = 0;
    const profile = formData.profile;
    
    // Common field mappings
    const fieldMappings = {
        'firstName': ['first name', 'firstname', 'fname', 'given name', 'givenname'],
        'lastName': ['last name', 'lastname', 'lname', 'family name', 'familyname', 'surname'],
        'email': ['email', 'e-mail', 'email address', 'e-mail address'],
        'phone': ['phone', 'telephone', 'phone number', 'telephone number', 'mobile', 'cell', 'cell phone'],
        'address': ['address', 'street address', 'street', 'addr'],
        'city': ['city', 'town'],
        'state': ['state', 'province', 'region'],
        'zipCode': ['zip', 'zip code', 'postal code', 'postcode', 'zipcode'],
        'linkedin': ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin.com'],
        'portfolio': ['portfolio', 'portfolio url', 'website', 'personal website', 'homepage']
    };
    
    Object.keys(fieldMappings).forEach(key => {
        if (profile[key]) {
            const value = profile[key];
            const possibleNames = fieldMappings[key];
            
            // Try to find and fill the field
            const field = findFormField(form, possibleNames);
            if (field && !field.value) {
                field.value = value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                filled++;
            }
        }
    });
    
    return filled;
}

function fillEducationFields(form) {
    let filled = 0;
    const education = formData.education[0]; // Use first education entry
    
    const fieldMappings = {
        'degree': ['degree', 'education degree', 'academic degree', 'qualification'],
        'fieldOfStudy': ['field of study', 'major', 'concentration', 'specialization', 'subject'],
        'institution': ['institution', 'university', 'college', 'school', 'institution name'],
        'graduationDate': ['graduation date', 'graduation year', 'year graduated', 'completion date'],
        'gpa': ['gpa', 'grade point average', 'grade point', 'academic average']
    };
    
    Object.keys(fieldMappings).forEach(key => {
        if (education[key]) {
            const value = education[key];
            const possibleNames = fieldMappings[key];
            
            const field = findFormField(form, possibleNames);
            if (field && !field.value) {
                field.value = value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                filled++;
            }
        }
    });
    
    return filled;
}

function fillExperienceFields(form) {
    let filled = 0;
    const experience = formData.experience[0]; // Use first experience entry
    
    const fieldMappings = {
        'jobTitle': ['job title', 'position', 'role', 'title', 'job position'],
        'company': ['company', 'employer', 'organization', 'company name', 'employer name'],
        'startDate': ['start date', 'employment start', 'job start', 'work start'],
        'endDate': ['end date', 'employment end', 'job end', 'work end', 'current'],
        'description': ['description', 'job description', 'role description', 'responsibilities', 'duties']
    };
    
    Object.keys(fieldMappings).forEach(key => {
        if (experience[key]) {
            const value = experience[key];
            const possibleNames = fieldMappings[key];
            
            const field = findFormField(form, possibleNames);
            if (field && !field.value) {
                field.value = value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                filled++;
            }
        }
    });
    
    return filled;
}

function fillSkillsFields(form) {
    let filled = 0;
    const skills = formData.skills;
    
    const fieldMappings = {
        'technicalSkills': ['technical skills', 'skills', 'technical expertise', 'programming skills', 'technologies'],
        'softSkills': ['soft skills', 'interpersonal skills', 'communication skills', 'leadership skills'],
        'languages': ['languages', 'language skills', 'spoken languages', 'foreign languages'],
        'certifications': ['certifications', 'certificates', 'professional certifications', 'credentials']
    };
    
    Object.keys(fieldMappings).forEach(key => {
        if (skills[key]) {
            const value = skills[key];
            const possibleNames = fieldMappings[key];
            
            const field = findFormField(form, possibleNames);
            if (field && !field.value) {
                field.value = value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                filled++;
            }
        }
    });
    
    return filled;
}

function findFormField(form, possibleNames) {
    console.log(`Looking for field with names:`, possibleNames);
    
    // Search by name attribute
    for (const name of possibleNames) {
        let field = form.querySelector(`[name*="${name}" i]`);
        if (field) {
            console.log(`Found field by name "${name}":`, field);
            return field;
        }
        
        field = form.querySelector(`[id*="${name}" i]`);
        if (field) {
            console.log(`Found field by ID "${name}":`, field);
            return field;
        }
        
        field = form.querySelector(`[placeholder*="${name}" i]`);
        if (field) {
            console.log(`Found field by placeholder "${name}":`, field);
            return field;
        }
    }
    
    // Search by label text
    const labels = form.querySelectorAll('label');
    console.log(`Found ${labels.length} labels to check`);
    
    for (const label of labels) {
        const labelText = label.textContent.toLowerCase();
        console.log(`Checking label: "${labelText}"`);
        
        for (const name of possibleNames) {
            if (labelText.includes(name.toLowerCase())) {
                const field = label.querySelector('input, textarea, select') || 
                             document.getElementById(label.getAttribute('for'));
                if (field) {
                    console.log(`Found field by label "${labelText}":`, field);
                    return field;
                }
            }
        }
    }
    
    console.log(`No field found for names:`, possibleNames);
    return null;
}

// Add manual test function for debugging
window.testFormDetection = function() {
    console.log('=== Testing Form Detection ===');
    console.log('Form data available:', formData);
    console.log('Forms on page:', document.querySelectorAll('form').length);
    console.log('Form detection status:', isFormDetected);
    console.log('Extension enabled:', isExtensionEnabled);
    console.log('Monitoring active:', !!window.jaffInterval);
    
    // Check for forms manually
    const forms = document.querySelectorAll('form');
    forms.forEach((form, index) => {
        console.log(`Form ${index + 1}:`, form);
        console.log('Form fields:', form.querySelectorAll('input, textarea, select').length);
    });
    
    // Check for common field types
    const inputs = document.querySelectorAll('input');
    console.log('Input fields:', inputs.length);
    inputs.forEach((input, index) => {
        console.log(`Input ${index + 1}:`, {
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            type: input.type
        });
    });
};

// Add manual auto-fill test function
window.testAutoFill = function() {
    console.log('=== Testing Auto-fill ===');
    if (typeof window.autoFillForm === 'function') {
        console.log('autoFillForm function is available');
        window.autoFillForm();
    } else {
        console.error('autoFillForm function is NOT available');
        console.log('Available functions:', Object.keys(window).filter(key => key.includes('auto') || key.includes('fill')));
    }
};

// Add function to check extension status
window.checkExtensionStatus = function() {
    console.log('=== Extension Status ===');
    console.log('Extension enabled:', isExtensionEnabled);
    console.log('Form monitoring active:', !!window.jaffInterval);
    console.log('Form data loaded:', !!formData);
    console.log('Form detection status:', isFormDetected);
    console.log('Background interval:', window.jaffInterval);
    console.log('URL observer:', window.jaffObserver);
};

// Add function to completely disable extension (for testing)
window.completelyDisableExtension = function() {
    console.log('=== Manually Disabling Extension ===');
    isExtensionEnabled = false;
    stopFormMonitoring();
    
    // Remove any existing prompts
    const prompt = document.getElementById('jaff-prompt');
    if (prompt) {
        prompt.remove();
    }
    
    // Clear all extension-related variables
    isFormDetected = false;
    formData = null;
    
    console.log('Extension manually disabled - completely silent now');
};

// Add function to re-enable extension (for testing)
window.reEnableExtension = function() {
    console.log('=== Manually Re-enabling Extension ===');
    isExtensionEnabled = true;
    startFormMonitoring();
    
    // Reload data
    chrome.storage.sync.get(['profile', 'education', 'experience', 'skills'], function(result) {
        if (result.profile || result.education || result.experience || result.skills) {
            formData = result;
            console.log('Extension data reloaded');
        }
    });
    
    console.log('Extension manually re-enabled');
};

// Add function to force complete silence (for testing)
window.forceSilence = function() {
    console.log('=== FORCING COMPLETE SILENCE ===');
    isExtensionEnabled = false;
    stopFormMonitoring();
    
    // Override console.log for extension-related messages
    const originalLog = console.log;
    console.log = function(...args) {
        const message = args.join(' ');
        if (!message.includes('Extension') && !message.includes('Form') && !message.includes('Found forms')) {
            originalLog.apply(console, args);
        }
    };
    
    console.log('Extension is now completely silent - no more console messages');
};

function showNotification(message, type) {
    // Remove existing notification
    const existingNotification = document.getElementById('jaff-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'jaff-notification';
    notification.className = `jaff-notification jaff-notification-${type}`;
    notification.textContent = message;
    
    // Add notification styles if not already present
    if (!document.getElementById('jaff-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'jaff-notification-styles';
        styles.textContent = `
            .jaff-notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10001;
                padding: 12px 20px;
                border-radius: 6px;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: jaff-notification-slide-in 0.3s ease-out;
            }
            
            @keyframes jaff-notification-slide-in {
                from {
                    transform: translateX(-50%) translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }
            
            .jaff-notification-success {
                background: #28a745;
            }
            
            .jaff-notification-error {
                background: #dc3545;
            }
            
            .jaff-notification-info {
                background: #17a2b8;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
} 