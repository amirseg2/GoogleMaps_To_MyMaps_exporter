(async () => {
  console.log("📍 Starting export of saved locations...");

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // More robust sidebar detection
  function findSidebar() {
    const selectors = [
      '[jsaction*="pane.scroll"]',
      '[role="region"]',
      '[data-value="Saved"]',
      '.widget-pane-content',
      '.section-scrollbox',
      '[class*="scrollbox"]',
      '[class*="pane"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.scrollHeight > element.clientHeight) {
        console.log(`✅ Found scrollable sidebar using selector: ${selector}`);
        return element;
      }
    }

    // Fallback: find any scrollable container
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      if (element.scrollHeight > element.clientHeight && 
          element.clientHeight > 200 && 
          element.scrollHeight > 300) {
        console.log(`✅ Found scrollable container as fallback`);
        return element;
      }
    }

    return null;
  }

  async function autoScrollSidebar(maxAttempts = 20) {
    console.log("🔄 Auto-scrolling the sidebar to load all items...");

    const sidebar = findSidebar();
    if (!sidebar) {
      console.warn("⚠️ Sidebar not found. Make sure you're on a saved places list page.");
      console.log("🔍 Available scrollable elements:", 
        [...document.querySelectorAll('*')].filter(el => 
          el.scrollHeight > el.clientHeight
        ).map(el => ({
          tagName: el.tagName,
          className: el.className,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        }))
      );
      return;
    }

    let prevHeight = 0;
    let attempts = 0;
    while (attempts < maxAttempts) {
      sidebar.scrollTo(0, sidebar.scrollHeight);
      console.log(`➡️ Scroll attempt ${attempts + 1}, height: ${sidebar.scrollHeight}`);
      await sleep(1500); // Increased wait time
      const newHeight = sidebar.scrollHeight;
      if (newHeight === prevHeight) {
        console.log("✅ No more new content loaded.");
        break;
      }
      prevHeight = newHeight;
      attempts++;
    }
  }

  await autoScrollSidebar();

  // Extract the list name from the page
  function getListName() {
    const selectors = [
      'h1.fontTitleLarge', // Based on user's example
      'h1[class*="fontTitle"]',
      'h1[class*="Title"]',
      '.title, .heading, h1, h2',
      '[class*="title"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText && element.innerText.trim().length > 0) {
        console.log(`✅ Found list name using selector: ${selector}`);
        return element.innerText.trim();
      }
    }

    return 'Saved Places'; // Default fallback
  }

  const listName = getListName();
  console.log(`📋 List name: "${listName}"`);

  // Generic selectors that work across different Google Maps versions
  function findPlaceCards() {
    const possibleSelectors = [
      // Generic jsaction patterns (most stable)
      'button[jsaction*="pane.wfvdle"]',
      'button[jsaction*="pane."]',
      '[jsaction*="pane."] button',
      
      // Generic button patterns in lists
      'button[jsaction][jslog]',
      'div[role="button"][jsaction]',
      
      // Generic clickable elements with place-like content
      'button:has(img):has([class*="font"])',
      'div[role="button"]:has(img)',
      
      // Elements containing typical place info
      'button:has([class*="rating"]), button:has([aria-label*="star"])',
      'button:has([dir="ltr"])',
      
      // Fallback to original selectors
      '.Nv2PK.THOPZb.CpccDe',
      '[data-value]',
      '[jsaction*="place"]'
    ];

    for (const selector of possibleSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`✅ Found ${elements.length} elements using selector: ${selector}`);
          
          // Simple validation - just check if they have basic card features
          const validCards = [...elements].filter(card => {
            const hasText = card.innerText && card.innerText.trim().length > 3;
            const hasAction = card.getAttribute('jsaction') || card.closest('[jsaction]');
            return hasText && hasAction;
          });
          
          if (validCards.length > 0) {
            console.log(`✅ ${validCards.length} potential place cards found`);
            return validCards;
          }
        }
      } catch (e) {
        console.log(`⚠️ Selector "${selector}" failed:`, e.message);
      }
    }

    return [];
  }

  const cards = findPlaceCards();
  console.log(`🧾 Found ${cards.length} card(s) with place data.`);

  if (cards.length === 0) {
    console.log("🔍 Debugging: Let's examine the page structure...");
    console.log("📋 Buttons with jsaction:", 
      [...document.querySelectorAll('button[jsaction]')].length
    );
    console.log("📋 Elements with images:", 
      [...document.querySelectorAll('*:has(img)')].length || "CSS :has() not supported"
    );
    console.log("📋 Elements with ratings:", 
      [...document.querySelectorAll('[aria-label*="star"], [class*="rating"]')].length
    );
    console.log("📋 Sample jsactions:", 
      [...document.querySelectorAll('[jsaction]')]
        .slice(0, 3)
        .map(el => el.getAttribute('jsaction')?.substring(0, 50))
    );
  }

  // Enhanced coordinate extraction function
  async function tryGetCoordinates(card, placeName) {
    let latitude = null;
    let longitude = null;
    
    // Method 1: Try to extract from jslog metadata
    const jslogEl = card.querySelector('[jslog]') || card;
    if (jslogEl) {
      const jslog = jslogEl.getAttribute('jslog');
      if (jslog && jslog.includes('metadata')) {
        try {
          const metadataMatch = jslog.match(/metadata:(\[.*?\])/);
          if (metadataMatch) {
            const metadataStr = metadataMatch[1];
            try {
              const decoded = atob(metadataStr.slice(2, -2));
              const coordMatch = decoded.match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (coordMatch) {
                latitude = parseFloat(coordMatch[1]);
                longitude = parseFloat(coordMatch[2]);
                console.log(`✅ Found coordinates in jslog for ${placeName}: ${latitude}, ${longitude}`);
                return { latitude, longitude };
              }
            } catch (e) {
              // Continue to next method
            }
          }
        } catch (e) {
          // Continue to next method
        }
      }
    }
    
    // Method 2: Try to extract from any links
    const linkEl = card.querySelector('a[href]') || card.closest('a[href]');
    if (linkEl?.href) {
      // Google Maps URL patterns
      const patterns = [
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // !3d{lat}!4d{lng}
        /@(-?\d+\.\d+),(-?\d+\.\d+)/, // @{lat},{lng}
        /ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // ll={lat},{lng}
        /center=(-?\d+\.\d+),(-?\d+\.\d+)/ // center={lat},{lng}
      ];
      
      for (const pattern of patterns) {
        const match = linkEl.href.match(pattern);
        if (match) {
          latitude = parseFloat(match[1]);
          longitude = parseFloat(match[2]);
          console.log(`✅ Found coordinates in URL for ${placeName}: ${latitude}, ${longitude}`);
          return { latitude, longitude };
        }
      }
    }
    
    // Method 3: Click the element and extract coordinates from URL change
    try {
      console.log(`🔄 Clicking ${placeName} to get coordinates...`);
      
      // Store current URL and list name to detect changes and verify return
      const originalUrl = window.location.href;
      const originalListName = document.querySelector('h1.fontTitleLarge')?.textContent;
      
      // Find the clickable element - prefer button or the card itself
      const clickableEl = card.querySelector('button') || card;
      if (!clickableEl) {
        console.warn(`No clickable element found for ${placeName}`);
        return { latitude: null, longitude: null };
      }
      
      // Click the element
      clickableEl.click();
      
      // Wait for URL to change with place details
      let urlChanged = false;
      let attempts = 0;
      const maxAttempts = 20; // 4 seconds total
      
      while (!urlChanged && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const currentUrl = window.location.href;
        
        if (currentUrl !== originalUrl) {
          urlChanged = true;
          console.log(`🔗 URL changed for ${placeName}`);
          
          // Extract coordinates from the new URL using the !3d!4d pattern
          const coordPattern = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
          const coordMatch = currentUrl.match(coordPattern);
          
          if (coordMatch) {
            latitude = parseFloat(coordMatch[1]);
            longitude = parseFloat(coordMatch[2]);
            console.log(`✅ Found coordinates from URL for ${placeName}: ${latitude}, ${longitude}`);
          } else {
            // Try alternative patterns
            const altPatterns = [
              /@(-?\d+\.\d+),(-?\d+\.\d+)/, // @{lat},{lng}
              /ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // ll={lat},{lng}
              /center=(-?\d+\.\d+),(-?\d+\.\d+)/ // center={lat},{lng}
            ];
            
            for (const pattern of altPatterns) {
              const match = currentUrl.match(pattern);
              if (match) {
                latitude = parseFloat(match[1]);
                longitude = parseFloat(match[2]);
                console.log(`✅ Found coordinates (alt pattern) for ${placeName}: ${latitude}, ${longitude}`);
                break;
              }
            }
          }
          
          // Navigate back to the list with multiple attempts
          console.log(`⬅️ Navigating back from ${placeName}`);
          let backAttempts = 0;
          let backSuccess = false;
          
          while (backAttempts < 5 && !backSuccess) {
            window.history.back();
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            // Check if we're back on the list page
            const currentListName = document.querySelector('h1.fontTitleLarge')?.textContent;
            const currentPageUrl = window.location.href;
            
            if (currentListName && currentListName.includes(originalListName) && 
                currentPageUrl === originalUrl) {
              backSuccess = true;
              console.log(`✅ Successfully returned to list after ${backAttempts + 1} attempts`);
            } else {
              backAttempts++;
              console.log(`🔄 Back attempt ${backAttempts + 1} for ${placeName}...`);
            }
          }
          
          if (!backSuccess) {
            console.warn(`⚠️ Could not navigate back to list from ${placeName} after ${backAttempts} attempts`);
          }
          
          return { latitude, longitude };
        }
        
        attempts++;
      }
      
      if (!urlChanged) {
        console.warn(`⚠️ URL did not change after clicking ${placeName}`);
      }
      
    } catch (e) {
      console.warn(`Failed to click and extract coordinates for ${placeName}:`, e);
    }
    
    console.log(`❌ No coordinates found for ${placeName}`);
    return { latitude: null, longitude: null };
  }

  // Process places with coordinate extraction
  console.log("🔄 Starting coordinate extraction for all places...");
  const placesWithCoords = [];
  
  let processedCount = 0;
  const maxPlaces = 50; // Safety limit
  
  while (processedCount < maxPlaces) {
    // Re-query place cards each time to get fresh DOM references
    const currentCards = findPlaceCards();
    if (!currentCards || currentCards.length === 0) {
      console.log("🔚 No more place cards found. Processing complete.");
      break;
    }
    
    // Skip already processed places
    if (processedCount >= currentCards.length) {
      console.log("🔚 All available places have been processed.");
      break;
    }
    
    const card = currentCards[processedCount];
    
    // Before processing each place, verify we're still on the saved list page
    const listNameCheck = document.querySelector('h1.fontTitleLarge');
    if (!listNameCheck || !listNameCheck.textContent.includes(listName)) {
      console.warn(`⚠️ No longer on saved list page. Stopping processing. Expected: "${listName}"`);
      break;
    }
    
    // Extract name with much better filtering
    let nameEl = null;
    let name = null;
    
    const headingSelectors = [
      '[class*="headline"] span[dir="ltr"]',
      '[class*="title"] span[dir="ltr"]',
      'span[dir="ltr"]:not([aria-label*="star"]):not([aria-label*="כוכב"])',
      '[class*="font"][class*="large"] span[dir="ltr"]',
      '[class*="font"][class*="medium"] span[dir="ltr"]'
    ];
    
    for (const selector of headingSelectors) {
      const candidates = card.querySelectorAll(selector);
      for (const candidate of candidates) {
        const text = candidate.innerText?.trim();
        if (text && 
            text.length > 2 && 
            text !== 'הערה' && 
            text !== 'שיתוף' && 
            text !== ' שיתוף' &&
            text !== '\nשיתוף' &&
            text !== 'Note' &&
            text !== 'Share' &&
            text !== 'Dropped pin' &&
            !text.match(/^\d+\.\d+$/) &&
            !text.match(/^\d+$/) &&
            !text.includes('כוכב') &&
            !text.includes('star') &&
            !text.includes('(') &&
            text.length < 100) {
          nameEl = candidate;
          name = text;
          break;
        }
      }
      if (name) break;
    }
    
    if (!name) {
      const allTextElements = card.querySelectorAll('span, div');
      for (const element of allTextElements) {
        const text = element.innerText?.trim();
        if (text && 
            text.length > 2 && 
            text.length < 100 &&
            !text.includes('(') &&
            !text.match(/^\d+\.\d+$/) &&
            text !== 'הערה' && 
            text !== 'שיתוף' && 
            text !== ' שיתוף' &&
            text !== '\nשיתוף' &&
            text !== 'Note' &&
            text !== 'Share' &&
            text !== 'Dropped pin') {
          name = text;
          break;
        }
      }
    }
    
    if (!name) {
      name = `Unnamed Place ${processedCount + 1}`;
    }

    // Comprehensive filtering for UI elements
    const uiElements = [
      'הערה', 'שיתוף', ' שיתוף', '\nשיתוף', // Hebrew UI elements
      'הוספה של הערה', 'הוספת הערה',
      'Note', 'Share', 'Add a note', 'Add note', // English UI elements  
      'Dropped pin', 'Pin', 'מקום', 'Place', 'Location',
      'Edit', 'עריכה', 'Delete', 'מחיקה',
      // Additional UI elements that might appear in popups
      'לצפייה בתמונות', 'סקירה כללית', 'כרטיסים', 'ביקורות', 'מידע כללי',
      'מסלול', 'נשמר', 'שליחה לטלפון', 'בקרבת מקום',
      'View photos', 'Overview', 'Tickets', 'Reviews', 'About',
      'Directions', 'Saved', 'Send to phone', 'Nearby',
      'לייק', 'כתיבת ביקורת', 'עוד שאלות', 'הוספת תמונות',
      'Like', 'Write a review', 'More questions', 'Add photos'
    ];
    
    const isUIElement = uiElements.some(uiText => 
      name === uiText || 
      name.trim() === uiText || 
      name.includes(uiText)
    );
    
    const isRating = name.match(/^\d+\.\d+$/) || name.match(/^\d+$/);
    const isTooShort = name.length < 3;
    const isUnnamed = name.startsWith('Unnamed Place');
    const isTimeCode = name.match(/^\d+:\d+$/); // e.g., "0:05", "0:23"
    const isPhoneNumber = name.match(/^\+\d+/) || name.match(/^\d{1,4}\s\d+/);
    
    if (isUIElement || isRating || isTooShort || isUnnamed || isTimeCode || isPhoneNumber) {
      console.log(`🚫 Skipping UI element/invalid: "${name}"`);
      processedCount++;
      continue;
    }

    // Extract coordinates
    console.log(`🔍 Processing place ${placesWithCoords.length + 1}: ${name} (card ${processedCount + 1}/${currentCards.length})`);
    const coords = await tryGetCoordinates(card, name);
    
    // Verify we're back on the saved list page after coordinate extraction
    const listNameCheckAfter = document.querySelector('h1.fontTitleLarge');
    if (!listNameCheckAfter || !listNameCheckAfter.textContent.includes(listName)) {
      console.warn(`⚠️ Lost saved list page after processing "${name}". Attempting to recover...`);
      
      // Try to navigate back to the saved list
      let attempts = 0;
      while (attempts < 3) {
        window.history.back();
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const recovery = document.querySelector('h1.fontTitleLarge');
        if (recovery && recovery.textContent.includes(listName)) {
          console.log(`✅ Recovered saved list page after ${attempts + 1} attempts`);
          break;
        }
        attempts++;
      }
      
      if (attempts >= 3) {
        console.error(`❌ Could not recover saved list page. Stopping at place ${placesWithCoords.length + 1}.`);
        break;
      }
    }
    
    // Extract other data
    const jsaction = card.getAttribute('jsaction') || card.closest('[jsaction]')?.getAttribute('jsaction');
    let link = null;
    
    if (jsaction) {
      link = `javascript:${jsaction.split(';')[0]}`;
    }

    const linkEl = card.querySelector('a[href]') || card.closest('a[href]');
    if (linkEl?.href) {
      link = linkEl.href;
    }

    // If no coordinates found, create a Google Maps search link
    if (!coords.latitude && !coords.longitude) {
      const searchQuery = encodeURIComponent(name + " Austria");
      link = `https://www.google.com/maps/search/${searchQuery}`;
    }

    const placeData = { 
      name: name.trim(), 
      link, 
      latitude: coords.latitude, 
      longitude: coords.longitude 
    };
    
    placesWithCoords.push(placeData);
    
    console.log(`🔹 Place ${placesWithCoords.length}:`, placeData);
    
    // Move to next card
    processedCount++;
    
    // Small delay between place processing
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const places = placesWithCoords;

  if (places.length === 0) {
    console.warn("❌ No usable places found. Try the following:");
    console.warn("1. Make sure you're on a Google Maps saved list page");
    console.warn("2. Try scrolling manually first");
    console.warn("3. Make sure the list has places in it");
    
    // Show more detailed debugging
    console.log("🔧 Debug info:");
    console.log("- Buttons with jsaction:", document.querySelectorAll('button[jsaction]').length);
    console.log("- Elements with text content:", [...document.querySelectorAll('*')].filter(el => el.innerText?.trim().length > 5).length);
    console.log("- Sample place-like text:", 
      [...document.querySelectorAll('span[dir="ltr"]')]
        .slice(0, 5)
        .map(el => el.innerText?.substring(0, 30))
        .filter(text => text && text.length > 2)
    );
    
    alert("❌ No places found. The page structure might have changed. Check the console for detailed debugging info.");
    return;
  }

  await chrome.storage.local.set({ 
    exportedPlaces: places,
    listName: listName,
    exportedAt: new Date().toISOString()
  });
  alert(`✅ Exported ${places.length} place(s) from "${listName}". You can now import them in My Maps.`);

  console.log("🎉 Export complete. Saved to chrome.storage.local.");
  console.log("📋 Exported places:", places);
})();

