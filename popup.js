// Load and display saved places info when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  await loadSavedPlacesInfo();
  await loadSettings();
});

async function loadSavedPlacesInfo() {
  const { exportedPlaces, listName, exportedAt } = await chrome.storage.local.get(['exportedPlaces', 'listName', 'exportedAt']);
  const placesInfoDiv = document.getElementById('placesInfo');
  
  if (exportedPlaces && exportedPlaces.length > 0) {
    const exportDate = exportedAt ? new Date(exportedAt).toLocaleDateString() : 'Unknown';
    placesInfoDiv.innerHTML = `
      <strong>📍 ${exportedPlaces.length} place(s) ready for import</strong><br>
      📋 From list: "${listName || 'Unknown'}"<br>
      📅 Exported: ${exportDate}
    `;
    placesInfoDiv.className = 'places-info';
    placesInfoDiv.style.display = 'block';
  } else {
    placesInfoDiv.innerHTML = `
      <strong>No places exported yet</strong><br>
      📤 Export places from a Google Maps saved list first
    `;
    placesInfoDiv.className = 'places-info no-places';
    placesInfoDiv.style.display = 'block';
  }
}

async function loadSettings() {
  const { openaiKey, descriptionLang } = await chrome.storage.local.get(['openaiKey', 'descriptionLang']);
  if (openaiKey) document.getElementById('openaiKey').value = openaiKey;
  
  // Set language preference with Hebrew as default
  const langSelect = document.getElementById('langPref');
  if (descriptionLang) {
    langSelect.value = descriptionLang;
  } else {
    langSelect.value = 'Hebrew'; // Default to Hebrew
  }
}

function showStatus(message, isError = false) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
  statusDiv.style.background = isError ? '#ffebee' : '#e8f5e8';
  statusDiv.style.borderLeft = isError ? '3px solid #f44336' : '3px solid #4CAF50';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

document.getElementById("exportBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Debug: Log the current URL
  console.log('Current tab URL:', tab.url);
  
  // More flexible Google Maps URL checking
  const isMapsPage = tab.url.includes('maps.google.com') || 
                     tab.url.includes('google.com/maps') ||
                     tab.url.includes('maps.google.');
  
  console.log('Is Maps page?', isMapsPage);
  
  if (!isMapsPage) {
    showStatus(`Not on Google Maps. Current URL: ${tab.url.substring(0, 50)}...`, true);
    return;
  }
  
  showStatus('Exporting places...');
  chrome.scripting.executeScript({ 
    target: { tabId: tab.id }, 
    files: ["content-scraper.js"] 
  }, () => {
    // Refresh the places info after export
    setTimeout(loadSavedPlacesInfo, 1000);
  });
});

document.getElementById("importBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Debug: Log the current URL
  console.log('Current tab URL for import:', tab.url);
  
  // Much more flexible My Maps URL checking
  const isMyMapsPage = tab.url.includes('mymaps.google.com') || 
                       tab.url.includes('google.com/mymaps') ||
                       tab.url.includes('mymaps.google.') ||
                       tab.url.includes('/mymaps/') ||
                       tab.url.includes('mymaps') ||
                       tab.url.includes('My Maps') ||
                       // My Maps editor URLs use /maps/d/edit pattern
                       (tab.url.includes('google.com/maps/d/') && tab.url.includes('edit')) ||
                       (tab.url.includes('google') && tab.url.includes('maps') && tab.url.includes('editor')) ||
                       // Alternative My Maps patterns
                       tab.url.includes('/maps/d/edit') ||
                       tab.url.includes('/maps/d/viewer');
  
  console.log('Is My Maps page?', isMyMapsPage);
  
  if (!isMyMapsPage) {
    showStatus(`Not on Google My Maps. Current URL: ${tab.url.substring(0, 50)}...`, true);
    return;
  }
  
  const { exportedPlaces } = await chrome.storage.local.get(['exportedPlaces']);
  if (!exportedPlaces || exportedPlaces.length === 0) {
    showStatus('No places to import. Export from Google Maps first.', true);
    return;
  }
  
  showStatus('Generating KML file...');
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-mymaps.js']
    });
    
    console.log('Script execution result:', result);
    
    if (chrome.runtime.lastError) {
      console.error('Script execution error:', chrome.runtime.lastError);
      showStatus('Failed to generate KML file', true);
    }
  } catch (error) {
    console.error('Failed to execute script:', error);
    showStatus('Failed to generate KML file', true);
  }
});

document.getElementById("clearBtn").addEventListener("click", async () => {
  // Show confirmation dialog
  const confirmed = confirm('Are you sure you want to clear all saved places data?\n\nThis will remove:\n• Exported places\n• List name\n• Export date\n\nThis action cannot be undone.');
  
  if (confirmed) {
    try {
      // Clear the saved places data
      await chrome.storage.local.remove(['exportedPlaces', 'listName', 'exportedAt']);
      
      // Refresh the places info display
      await loadSavedPlacesInfo();
      
      showStatus('✅ All saved places data cleared successfully');
      console.log('🗑️ Cleared saved places data');
    } catch (error) {
      showStatus('❌ Failed to clear data', true);
      console.error('Failed to clear data:', error);
    }
  }
});

document.getElementById("saveSettings").addEventListener("click", async () => {
  const key = document.getElementById("openaiKey").value;
  const lang = document.getElementById("langPref").value;
  await chrome.storage.local.set({ openaiKey: key, descriptionLang: lang });
  showStatus('Settings saved successfully');
});