document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
    
    // Load saved data when popup opens
    loadSavedData();
    
    // Add event listeners for dynamic content
    document.getElementById('addEducation').addEventListener('click', addEducationItem);
    document.getElementById('addExperience').addEventListener('click', addExperienceItem);
    
    // Extension toggle functionality
    const extensionToggle = document.getElementById('extensionEnabled');
    if (extensionToggle) {
        // Load saved toggle state
        chrome.storage.sync.get(['extensionEnabled'], function(result) {
            if (result.extensionEnabled !== undefined) {
                extensionToggle.checked = result.extensionEnabled;
                updateToggleLabel(extensionToggle.checked);
            }
        });
        
        // Handle toggle changes
        extensionToggle.addEventListener('change', function() {
            const isEnabled = this.checked;
            chrome.storage.sync.set({extensionEnabled: isEnabled}, function() {
                updateToggleLabel(isEnabled);
                showStatus(`Extension ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
                
                // Notify content scripts about the change
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0] && tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
                        try {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: 'extensionToggled',
                                enabled: isEnabled
                            });
                        } catch (error) {
                            console.log('Could not notify content script:', error.message);
                        }
                    }
                });
            });
        });
    }
    
    // Main action buttons
    document.getElementById('saveAll').addEventListener('click', function() {
        // Check if we're in a valid context before saving
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            saveAllData();
        } else {
            showStatus('Extension context not available', 'error');
        }
    });
    document.getElementById('exportData').addEventListener('click', exportData);
    document.getElementById('importData').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    
    document.getElementById('importFile').addEventListener('change', importData);
});

function addEducationItem() {
    const educationList = document.getElementById('educationList');
    const newItem = document.createElement('div');
    newItem.className = 'education-item';
    newItem.innerHTML = `
        <div class="form-group">
            <label>Degree</label>
            <input type="text" name="degree" placeholder="e.g., Bachelor of Science">
        </div>
        <div class="form-group">
            <label>Field of Study</label>
            <input type="text" name="fieldOfStudy" placeholder="e.g., Computer Science">
        </div>
        <div class="form-group">
            <label>Institution</label>
            <input type="text" name="institution" placeholder="e.g., University Name">
        </div>
        <div class="form-group">
            <label>Graduation Date</label>
            <input type="month" name="graduationDate">
        </div>
        <div class="form-group">
            <label>GPA</label>
            <input type="text" name="gpa" placeholder="e.g., 3.8">
        </div>
        <button type="button" class="btn-secondary remove-btn" onclick="removeItem(this)">Remove</button>
    `;
    educationList.appendChild(newItem);
}

function addExperienceItem() {
    const experienceList = document.getElementById('experienceList');
    const newItem = document.createElement('div');
    newItem.className = 'experience-item';
    newItem.innerHTML = `
        <div class="form-group">
            <label>Job Title</label>
            <input type="text" name="jobTitle" placeholder="e.g., Software Engineer">
        </div>
        <div class="form-group">
            <label>Company</label>
            <input type="text" name="company" placeholder="e.g., Company Name">
        </div>
        <div class="form-group">
            <label>Start Date</label>
            <input type="month" name="startDate">
        </div>
        <div class="form-group">
            <label>End Date</label>
            <input type="month" name="endDate">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="3" placeholder="Brief description of your role and achievements"></textarea>
        </div>
        <button type="button" class="btn-secondary remove-btn" onclick="removeItem(this)">Remove</button>
    `;
    experienceList.appendChild(newItem);
}

function removeItem(button) {
    button.parentElement.remove();
}

function loadSavedData() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('Chrome storage not available');
        return;
    }
    
    chrome.storage.sync.get(['profile', 'education', 'experience', 'skills'], function(result) {
        if (result.profile) {
            populateProfileForm(result.profile);
        }
        if (result.education) {
            populateEducationList(result.education);
        }
        if (result.experience) {
            populateExperienceList(result.experience);
        }
        if (result.skills) {
            populateSkillsForm(result.skills);
        }
    });
}

function populateProfileForm(profile) {
    Object.keys(profile).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            element.value = profile[key];
        }
    });
}

function populateEducationList(education) {
    const educationList = document.getElementById('educationList');
    educationList.innerHTML = '';
    
    education.forEach(edu => {
        const newItem = document.createElement('div');
        newItem.className = 'education-item';
        newItem.innerHTML = `
            <div class="form-group">
                <label>Degree</label>
                <input type="text" name="degree" value="${edu.degree || ''}" placeholder="e.g., Bachelor of Science">
            </div>
            <div class="form-group">
                <label>Field of Study</label>
                <input type="text" name="fieldOfStudy" value="${edu.fieldOfStudy || ''}" placeholder="e.g., Computer Science">
            </div>
            <div class="form-group">
                <label>Institution</label>
                <input type="text" name="institution" value="${edu.institution || ''}" placeholder="e.g., University Name">
            </div>
            <div class="form-group">
                <label>Graduation Date</label>
                <input type="month" name="graduationDate" value="${edu.graduationDate || ''}">
            </div>
            <div class="form-group">
                <label>GPA</label>
                <input type="text" name="gpa" value="${edu.gpa || ''}" placeholder="e.g., 3.8">
            </div>
            <button type="button" class="btn-secondary remove-btn" onclick="removeItem(this)">Remove</button>
        `;
        educationList.appendChild(newItem);
    });
}

function populateExperienceList(experience) {
    const experienceList = document.getElementById('experienceList');
    experienceList.innerHTML = '';
    
    experience.forEach(exp => {
        const newItem = document.createElement('div');
        newItem.className = 'experience-item';
        newItem.innerHTML = `
            <div class="form-group">
                <label>Job Title</label>
                <input type="text" name="jobTitle" value="${exp.jobTitle || ''}" placeholder="e.g., Software Engineer">
            </div>
            <div class="form-group">
                <label>Company</label>
                <input type="text" name="company" value="${exp.company || ''}" placeholder="e.g., Company Name">
            </div>
            <div class="form-group">
                <label>Start Date</label>
                <input type="month" name="startDate" value="${exp.startDate || ''}">
            </div>
            <div class="form-group">
                <label>End Date</label>
                <input type="month" name="endDate" value="${exp.endDate || ''}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" rows="3" placeholder="Brief description of your role and achievements">${exp.description || ''}</textarea>
            </div>
            <button type="button" class="btn-secondary remove-btn" onclick="removeItem(this)">Remove</button>
        `;
        experienceList.appendChild(newItem);
    });
}

function populateSkillsForm(skills) {
    Object.keys(skills).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            element.value = skills[key];
        }
    });
}

function collectProfileData() {
    const profile = {};
    const profileForm = document.getElementById('profileForm');
    const formData = new FormData(profileForm);
    
    for (let [key, value] of formData.entries()) {
        profile[key] = value;
    }
    
    return profile;
}

function collectEducationData() {
    const education = [];
    const educationItems = document.querySelectorAll('.education-item');
    
    educationItems.forEach(item => {
        const inputs = item.querySelectorAll('input, textarea');
        const eduItem = {};
        
        inputs.forEach(input => {
            if (input.name) {
                eduItem[input.name] = input.value;
            }
        });
        
        // Only add if at least one field has data
        if (Object.values(eduItem).some(value => value.trim() !== '')) {
            education.push(eduItem);
        }
    });
    
    return education;
}

function collectExperienceData() {
    const experience = [];
    const experienceItems = document.querySelectorAll('.experience-item');
    
    experienceItems.forEach(item => {
        const inputs = item.querySelectorAll('input, textarea');
        const expItem = {};
        
        inputs.forEach(input => {
            if (input.name) {
                expItem[input.name] = input.value;
            }
        });
        
        // Only add if at least one field has data
        if (Object.values(expItem).some(value => value.trim() !== '')) {
            experience.push(expItem);
        }
    });
    
    return experience;
}

function collectSkillsData() {
    const skills = {};
    const skillsInputs = document.querySelectorAll('#skills input, #skills textarea');
    
    skillsInputs.forEach(input => {
        if (input.id) {
            skills[input.id] = input.value;
        }
    });
    
    return skills;
}

function saveAllData() {
    const profile = collectProfileData();
    const education = collectEducationData();
    const experience = collectExperienceData();
    const skills = collectSkillsData();
    
    const data = {
        profile,
        education,
        experience,
        skills,
        lastUpdated: new Date().toISOString()
    };
    
    chrome.storage.sync.set(data, function() {
        showStatus('All information saved successfully!', 'success');
        
        // Try to send message to content script, but handle errors gracefully
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                // Only try to communicate with web pages
                if (tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
                    try {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'updateFormData',
                            data: data
                        }, function(response) {
                            // Handle response or connection errors
                            if (chrome.runtime.lastError) {
                                // Content script not available, which is normal for some pages
                                console.log('Content script not available on this page:', chrome.runtime.lastError.message);
                            }
                        });
                    } catch (error) {
                        // Handle any other errors
                        console.log('Could not send message to content script:', error.message);
                    }
                } else {
                    console.log('Not a web page, skipping content script communication');
                }
            }
        });
    });
}

function exportData() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        showStatus('Chrome storage not available', 'error');
        return;
    }
    
    chrome.storage.sync.get(null, function(data) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'job-application-data.json';
        link.click();
        
        URL.revokeObjectURL(url);
        showStatus('Data exported successfully!', 'success');
    });
}

function importData(event) {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        showStatus('Chrome storage not available', 'error');
        return;
    }
    
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            chrome.storage.sync.set(data, function() {
                loadSavedData();
                showStatus('Data imported successfully!', 'success');
            });
        } catch (error) {
            showStatus('Error importing data. Please check file format.', 'error');
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

function updateToggleLabel(isEnabled) {
    const toggleLabel = document.querySelector('.toggle-label');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusDot = statusIndicator?.querySelector('.status-dot');
    const statusText = statusIndicator?.querySelector('.status-text');
    
    if (toggleLabel) {
        toggleLabel.textContent = isEnabled ? 'Extension Enabled' : 'Extension Disabled';
        toggleLabel.classList.toggle('disabled', !isEnabled);
    }
    
    if (statusDot && statusText) {
        statusDot.classList.toggle('active', isEnabled);
        statusDot.classList.toggle('inactive', !isEnabled);
        statusText.textContent = isEnabled ? 'Active' : 'Inactive';
    }
}

function showStatus(message, type) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status';
    }, 3000);
} 