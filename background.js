// Background service worker for Job Application Form Filler
chrome.runtime.onInstalled.addListener(function() {
    console.log('Job Application Form Filler extension installed');
    
    // Set default values for first-time users
    chrome.storage.sync.get(['profile', 'education', 'experience', 'skills'], function(result) {
        if (!result.profile && !result.education && !result.experience && !result.skills) {
            // Set default profile structure
            const defaultData = {
                profile: {
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    address: '',
                    city: '',
                    state: '',
                    zipCode: '',
                    linkedin: '',
                    portfolio: ''
                },
                education: [{
                    degree: '',
                    fieldOfStudy: '',
                    institution: '',
                    graduationDate: '',
                    gpa: ''
                }],
                experience: [{
                    jobTitle: '',
                    company: '',
                    startDate: '',
                    endDate: '',
                    description: ''
                }],
                skills: {
                    technicalSkills: '',
                    softSkills: '',
                    languages: '',
                    certifications: ''
                },
                lastUpdated: new Date().toISOString()
            };
            
            chrome.storage.sync.set(defaultData, function() {
                console.log('Default data structure created');
            });
        }
    });
});

// Handle extension icon click
chrome.action.onClicked.addListener(function(tab) {
    // This will open the popup automatically due to manifest configuration
    console.log('Extension icon clicked');
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getFormData') {
        chrome.storage.sync.get(['profile', 'education', 'experience', 'skills'], function(result) {
            sendResponse(result);
        });
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'updateFormData') {
        chrome.storage.sync.set(request.data, function() {
            sendResponse({status: 'updated'});
        });
        return true;
    }
});

// Handle storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync') {
        // Notify all tabs about data changes
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'dataUpdated',
                    changes: changes
                }).catch(() => {
                    // Ignore errors for tabs that don't have content scripts
                });
            });
        });
    }
});

// Context menu for quick access
chrome.runtime.onInstalled.addListener(function() {
    try {
        chrome.contextMenus.create({
            id: 'jaff-context-menu',
            title: 'Job Application Form Filler',
            contexts: ['page']
        });
        
        chrome.contextMenus.create({
            id: 'jaff-auto-fill',
            parentId: 'jaff-context-menu',
            title: 'Auto-fill Forms',
            contexts: ['page']
        });
        
        chrome.contextMenus.create({
            id: 'jaff-open-popup',
            parentId: 'jaff-context-menu',
            title: 'Open Settings',
            contexts: ['page']
        });
    } catch (error) {
        console.log('Could not create context menus:', error.message);
    }
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === 'jaff-auto-fill') {
        chrome.tabs.sendMessage(tab.id, {
            action: 'autoFillFromContextMenu'
        }).catch(() => {
            // If content script is not available, open popup
            chrome.action.openPopup();
        });
    } else if (info.menuItemId === 'jaff-open-popup') {
        chrome.action.openPopup();
    }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(function(command) {
    if (command === 'auto-fill-form') {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'autoFillFromKeyboard'
                }).catch(() => {
                    // If content script is not available, open popup
                    chrome.action.openPopup();
                });
            }
        });
    }
}); 