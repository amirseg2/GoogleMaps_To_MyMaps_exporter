console.log('SCRIPT START: content-mymaps.js is being executed');

(async () => {
  try {
  console.log('ASYNC FUNCTION START: Beginning main execution');
  // Configuration
  const CONFIG = {
    debug: {
      enabled: false,  // Set to true to enable detailed logging
      logOpenAIRequests: false,  // Set to true to log full OpenAI requests/responses
    },
    testing: {
      enabled: false,
      placesLimit: 5
    },
    processing: {
      concurrentLimit: 5,
      delayBetweenRequests: 200,
      delayBetweenBatches: 1000
    },
    invalidPlaceNames: ['שיתוף', 'הערה', 'Share', 'Note', 'Dropped pin']
  };

  // Logging helper
  const logger = {
    debug: (message, data) => {
      if (CONFIG.debug.enabled) {
        console.log(message, data || '');
      }
    },
    info: (message) => {
      // Always log important info
      console.log(message);
    },
    warn: (message, error) => {
      // Always log warnings
      console.warn(message, error || '');
    }
  };

  // Initialize storage and validate requirements
  const initializeStorage = async () => {
    const { exportedPlaces, openaiKey, listName, descriptionLang } = await chrome.storage.local.get([
      "exportedPlaces", "openaiKey", "listName", "descriptionLang"
    ]);

    if (!exportedPlaces?.length) {
      alert("⚠️ No places found. Export from Google Maps first.");
      return null;
    }

    if (!openaiKey) {
      const key = prompt(
        "Please enter your OpenAI API key to enrich places with descriptions and types. " +
        "You can get one from https://platform.openai.com/api-keys"
      );
      if (key) {
        await chrome.storage.local.set({ openaiKey: key });
        chrome.tabs.reload();
        return null;
      }
      alert("⚠️ No OpenAI key provided. Places will be exported without enrichment.");
    }

    return { exportedPlaces, openaiKey, listName, descriptionLang };
  };

  // Initialize storage
  console.log('Initializing storage...');
  const storage = await initializeStorage();
  console.log('Storage initialization result:', storage ? 'Success' : 'Failed');
  if (!storage) {
    console.log('Storage initialization failed or was cancelled. Exiting...');
    return;
  }
  console.log('Storage initialized successfully:', {
    hasExportedPlaces: !!storage.exportedPlaces?.length,
    hasOpenAIKey: !!storage.openaiKey,
    listName: storage.listName,
    descriptionLang: storage.descriptionLang
  });

  // Filter and prepare places
  const isValidPlace = place => (
    place.name.length > 2 &&
    !CONFIG.invalidPlaceNames.includes(place.name) &&
    !place.name.match(/^\d+\.\d+$/)
  );

  let placesToProcess = storage.exportedPlaces.filter(isValidPlace);
  const allFilteredPlaces = [...placesToProcess];

  logger.info('Initial data check:', {
    totalExportedPlaces: storage.exportedPlaces.length,
    validPlaces: placesToProcess.length,
    listName: storage.listName
  });

  if (CONFIG.testing.enabled) {
    placesToProcess = placesToProcess.slice(0, CONFIG.testing.placesLimit);
    logger.info(`🧪 Testing Mode: Processing ${CONFIG.testing.placesLimit} places`);
  }

  if (placesToProcess.length === 0) {
    logger.warn('❌ No valid places to process!');
    return;
  }

  logger.info(`🎯 Starting processing of ${placesToProcess.length} places from "${storage.listName || 'Unnamed List'}"`);
  
  console.log('DEBUG: About to create UI panel');
  
  const typeIcons = {
    "Museum": "🏛️", "Restaurant": "🍽️", "Cafe": "☕", "Park": "🌳",
    "Hotel": "🏨", "Motel": "🏨", "AirBnB": "🏠", "Historical Site": "🏰",
    "Beach": "🏖️", "Beach/Lakeside": "🌅", "Bar": "🍸", "Shopping": "🛍️",
    "Airport": "✈️", "Train Station": "🚉", "Cable Railway": "🚠",
    "Zip Line": "🧗", "Walking Trail": "🥾", "Lake": "🏞️", "Zoo": "🦁",
    "Mountain": "⛰️", "Amusement Park": "🎢", "Waterfall": "💧",
    "Mountain Slide": "🛷", "Town": "🏘️", "Village": "🏘️", "Rope Park": "🧗‍♂️",
    "Market": "🛒", "Therme": "♨️", "Parking": "🅿️", "Factory": "🏭", "Unknown": "📌"
  };

  // Create progress panel
  try {
    console.log('DEBUG: Creating panel element');
    const panel = document.createElement("div");
    panel.style = "position:fixed;top:20px;right:20px;width:400px;background:white;border:1px solid #ccc;padding:15px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-height:85vh;overflow-y:auto;font-family:sans-serif;font-size:13px;border-radius:8px;";

    const closeButton = document.createElement("button");
    closeButton.innerHTML = "✕";
    closeButton.style = "position:absolute;top:10px;right:10px;background:none;border:none;font-size:18px;cursor:pointer;color:#666;";
    closeButton.addEventListener('click', () => panel.remove());

    panel.innerHTML = `
      <div style="margin-bottom: 15px; padding-right: 20px;">
        <h3 style='margin:0; color:#1976d2;'>
          📍 Import Generator: "${storage.listName || 'Saved List'}"
          ${CONFIG.testing.enabled ? '<span style="font-size: 12px; background: #ff9800; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">Testing Mode</span>' : ''}
        </h3>
      </div>
      <div style="background: #e3f2fd; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 12px;">
        <strong>🔄 Processing places...</strong><br>
        ${CONFIG.testing.enabled 
          ? `Testing AI enrichment with ${CONFIG.testing.placesLimit} places (${allFilteredPlaces.length} total places will be exported).`
          : `Enriching all ${placesToProcess.length} places with AI descriptions.`}<br>
        A KML file will be generated with custom icons and styles for Google My Maps.
      </div>
      <div id="progress" style="background: #f5f5f5; height: 20px; border-radius: 10px; overflow: hidden; margin-bottom: 15px;">
        <div id="progressBar" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
      <div id="status">Starting...</div>
      <div id="results" style="margin-top: 15px;"></div>
    `;

    panel.appendChild(closeButton);
    console.log('DEBUG: About to append panel to document.body');
    document.body.appendChild(panel);
    console.log('DEBUG: Panel appended successfully');

    console.log('DEBUG: Getting UI elements');
    statusDiv = panel.querySelector('#status');
    progressBar = panel.querySelector('#progressBar');
    resultsDiv = panel.querySelector('#results');
    console.log('DEBUG: Got UI elements successfully', {
      hasStatusDiv: !!statusDiv,
      hasProgressBar: !!progressBar,
      hasResultsDiv: !!resultsDiv
    });
  } catch (error) {
    console.error('Failed to create UI panel:', error);
  }

  // OpenAI enrichment helpers
  const createPrompt = (placeName, supportedTypes, language = 'Hebrew') => {
    const isHebrew = language === 'Hebrew';  // Default to Hebrew if language is undefined
    return isHebrew
      ? `אני מתכנן טיול ורוצה לדעת יותר על המקום הזה: "${placeName}".\n\n` +
        `אנא ספק את המידע בפורמט המדויק הבא:\n\n` +
        `TYPE: [חובה לבחור בדיוק אחד מהסוגים הבאים: ${supportedTypes}]\n` +
        `WEBSITE: [כתובת האתר הרשמי אם קיים, אחרת השאר ריק]\n` +
        `DESCRIPTION: [תיאור קצר ומעניין של 2-3 משפטים בעברית]`
      : `I'm planning a trip and want to know more about this place: "${placeName}".\n\n` +
        `Please provide the information in exactly this format:\n\n` +
        `TYPE: [must be exactly one of these: ${supportedTypes}]\n` +
        `WEBSITE: [official website URL if available, otherwise leave empty]\n` +
        `DESCRIPTION: [a short and engaging 2-3 sentence description in ${language || "English"}]`;
  };

  const parseOpenAIResponse = (content) => {
    const matches = {
      type: content.match(/TYPE:\s*([^\n]+)/i),
      website: content.match(/WEBSITE:\s*([^\n]+)/i),
      description: content.match(/DESCRIPTION:\s*([^\n]+(?:\n[^\n]+)*)/i)
    };

    return {
      type: (matches.type?.[1] || "Unknown").replace(/[\[\]]/g, '').trim(),
      website: (matches.website?.[1] || "").replace(/[\[\]]/g, '').trim(),
      description: (matches.description?.[1] || "").replace(/[\[\]]/g, '').trim()
    };
  };

  const enrichPlace = async (place) => {
    console.log(`🔄 [enrichPlace] Starting enrichment for "${place.name}"`);

    if (!storage.openaiKey) {
      console.log(`⚠️ [enrichPlace] No OpenAI key available for "${place.name}"`);
      logger.warn('No OpenAI key available, skipping enrichment');
      return { ...place, type: "Unknown", website: "", description: "" };
    }

    try {
      const supportedTypes = Object.keys(typeIcons).join(', ');
      const prompt = createPrompt(place.name, supportedTypes, storage.descriptionLang);
      
      logger.debug(`Created prompt for "${place.name}"`, { prompt });

      console.log(`📤 [enrichPlace] Preparing OpenAI request for "${place.name}"`);
      const requestBody = {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: storage.descriptionLang === 'Hebrew'
              ? "אתה מומחה לתכנון טיולים שעוזר למישהו לתכנן טיול. ספק סיכומים ידידותיים, מדויקים ושימושיים על מקומות מעניינים. חשוב מאוד: בחר את סוג המקום אך ורק מתוך הרשימה שתקבל."
              : "You are an expert travel planner helping someone plan a trip. Provide friendly, accurate, and useful summaries about places of interest. IMPORTANT: You must classify the location type using ONLY the provided list of types."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      };

      console.log(`🌐 [enrichPlace] Making OpenAI API call for "${place.name}"`);
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + storage.openaiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      console.log(`✅ [enrichPlace] Received OpenAI response for "${place.name}"`);

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || "";
      const parsed = parseOpenAIResponse(content);

      // Validate type
      if (!typeIcons.hasOwnProperty(parsed.type)) {
        console.warn(`⚠️ Invalid type "${parsed.type}" returned for "${place.name}"`);
      }

      console.log(`✨ [enrichPlace] Successfully enriched "${place.name}" as type: ${parsed.type}`);
      return { ...place, ...parsed };
    } catch (error) {
      console.warn(`❌ [enrichPlace] Failed to enrich "${place.name}":`, error);
      return { ...place, type: "Unknown", website: "", description: "" };
    }
  };

  console.log('DEBUG: About to create UI panel');
  
  // Create progress panel
  try {
    console.log('DEBUG: Creating panel element');
    const panel = document.createElement("div");
  panel.style = "position:fixed;top:20px;right:20px;width:400px;background:white;border:1px solid #ccc;padding:15px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-height:85vh;overflow-y:auto;font-family:sans-serif;font-size:13px;border-radius:8px;";

  const closeButton = document.createElement("button");
  closeButton.innerHTML = "✕";
  closeButton.style = "position:absolute;top:10px;right:10px;background:none;border:none;font-size:18px;cursor:pointer;color:#666;";
  closeButton.addEventListener('click', () => panel.remove());

  panel.innerHTML = `
    <div style="margin-bottom: 15px; padding-right: 20px;">
      <h3 style='margin:0; color:#1976d2;'>
        📍 Import Generator: "${storage.listName || 'Saved List'}"
        ${TESTING_MODE ? '<span style="font-size: 12px; background: #ff9800; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">Testing Mode</span>' : ''}
      </h3>
    </div>
    <div style="background: #e3f2fd; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 12px;">
      <strong>🔄 Processing places...</strong><br>
      ${TESTING_MODE 
        ? `Testing AI enrichment with ${TEST_PLACES_LIMIT} places (${allFilteredPlaces.length} total places will be exported).`
        : `Enriching all ${filteredPlaces.length} places with AI descriptions.`}<br>
      A KML file will be generated with custom icons and styles for Google My Maps.
    </div>
    <div id="progress" style="background: #f5f5f5; height: 20px; border-radius: 10px; overflow: hidden; margin-bottom: 15px;">
      <div id="progressBar" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;"></div>
    </div>
    <div id="status">Starting...</div>
    <div id="results" style="margin-top: 15px;"></div>
  `;

    panel.appendChild(closeButton);
    console.log('DEBUG: About to append panel to document.body');
    document.body.appendChild(panel);
    console.log('DEBUG: Panel appended successfully');
  } catch (error) {
    console.error('Failed to create UI panel:', error);
  }

  console.log('DEBUG: Getting UI elements');
  try {
    const statusDiv = panel.querySelector('#status');
    const progressBar = panel.querySelector('#progressBar');
    const resultsDiv = panel.querySelector('#results');
    console.log('DEBUG: Got UI elements successfully', {
      hasStatusDiv: !!statusDiv,
      hasProgressBar: !!progressBar,
      hasResultsDiv: !!resultsDiv
    });

  // Process places in parallel with concurrency limit
  const CONCURRENT_LIMIT = 5; // Maximum number of parallel API calls
  const enrichedPlaces = [];
  let processedCount = 0;

  // Helper function to update progress
  const updateProgress = (place) => {
    processedCount++;
    const progress = (processedCount / filteredPlaces.length) * 100;
    progressBar.style.width = progress + '%';
    statusDiv.innerHTML = `Processing ${processedCount}/${filteredPlaces.length}: <strong>${place.name}</strong>`;
  };

  console.log('CHECKPOINT 1: Before batch processing');
  debugger; // Force debugger to pause here

  // Initialize tracking variables
  let totalProcessed = 0;

  console.log('CHECKPOINT 2: Variables initialized', {
    placesToProcess: placesToProcess.length,
    openaiKey: !!storage.openaiKey,
    descriptionLang: storage.descriptionLang
  });

  logger.info('🔍 Current state:', {
    placesToProcess: placesToProcess.length,
    concurrentLimit: CONFIG.processing.concurrentLimit,
    totalBatches: Math.ceil(placesToProcess.length / CONFIG.processing.concurrentLimit)
  });

  // Process places in batches
  try {
    logger.info('🚀 Starting place enrichment process');

    console.log('CHECKPOINT 3: About to start batch loop');
    debugger; // Force debugger to pause here
    for (let i = 0; i < placesToProcess.length; i += CONFIG.processing.concurrentLimit) {
      console.log('CHECKPOINT 4: Starting batch iteration', { i, batchSize: CONFIG.processing.concurrentLimit });
      const batch = placesToProcess.slice(i, i + CONFIG.processing.concurrentLimit);
      const batchNumber = Math.floor(i/CONFIG.processing.concurrentLimit) + 1;
      const totalBatches = Math.ceil(placesToProcess.length/CONFIG.processing.concurrentLimit);
      
      logger.info('📦 Batch details:', {
        batchNumber,
        totalBatches,
        batchSize: batch.length,
        firstPlace: batch[0]?.name,
        lastPlace: batch[batch.length-1]?.name
      });
      
      logger.info(`🔄 Processing batch ${batchNumber}/${totalBatches} (places ${i + 1}-${i + batch.length} of ${placesToProcess.length})`);
      
      console.log('CHECKPOINT 5: About to process batch', { 
        batchNumber, 
        places: batch.map(p => p.name)
      });

      const batchPromises = batch.map(async (place, index) => {
        try {
          console.log(`CHECKPOINT 6: Processing place "${place.name}"`);
          const enriched = await enrichPlace(place);
          totalProcessed++;
          
          updateProgress(place);
          logger.info(`✓ [${totalProcessed}/${placesToProcess.length}] Processed "${place.name}" (Type: ${enriched.type})`);
          
          // Small delay between requests in the same batch
          if (index < batch.length - 1) { // Don't delay after last item in batch
            logger.debug(`Waiting ${CONFIG.processing.delayBetweenRequests}ms before next request...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.processing.delayBetweenRequests));
          }
          return enriched;
        } catch (error) {
          logger.warn(`Failed to process place "${place.name}"`, error);
          return {
            ...place,
            type: "Unknown",
            website: "",
            description: "Failed to process this place"
          };
        }
      });

      console.log('CHECKPOINT 7: Waiting for batch promises');
      const batchResults = await Promise.all(batchPromises);
      console.log('CHECKPOINT 8: Batch completed', { 
        batchNumber, 
        resultsCount: batchResults.length 
      });
      enrichedPlaces.push(...batchResults);
      
      logger.info(`✅ Completed batch ${batchNumber}/${totalBatches} (${totalProcessed} places processed)`);
      
      // Small delay between batches to avoid rate limiting
      if (i + CONCURRENT_LIMIT < filteredPlaces.length) {
        logger.debug(`Waiting ${CONFIG.processing.delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.processing.delayBetweenBatches));
      }
    }

    logger.info(`🎯 Enrichment complete! Processed ${totalProcessed} places`);
    logger.info('Enrichment results:', {
      totalProcessed,
      enrichedPlacesLength: enrichedPlaces.length,
      typesFound: [...new Set(enrichedPlaces.map(p => p.type))]
    });
  } catch (error) {
    logger.warn('Failed during batch processing:', error);
    throw error; // Re-throw to be caught by the main error handler
  }

  // Verify we have places to process
  if (enrichedPlaces.length === 0) {
    logger.warn('❌ No places were enriched!');
    return;
  }

  // Add remaining places without AI enrichment if in testing mode
  if (TESTING_MODE) {
    const remainingPlaces = allFilteredPlaces.slice(TEST_PLACES_LIMIT);
    for (const place of remainingPlaces) {
      enrichedPlaces.push({
        ...place,
        type: "Unknown",
        website: "",
        description: "Place added without AI enrichment (testing mode)"
      });
    }
    logger.info(`📎 Added ${remainingPlaces.length} additional places without AI enrichment`);
  }

  // KML style configuration
  const KML_STYLES = {
    // Base styles for special cases
    map: {
      default: {
        id: 'icon-1899-DB4436',
        color: 'ff3644db',
        icon: 'https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png'
      },
      historical: {
        id: 'icon-1603-0288D1',
        color: 'ffd18802',
        icon: 'https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png'
      }
    },
    // Icon mappings for place types
    icons: {
      'Museum': 'museum',
      'Restaurant': 'dining',
      'Cafe': 'coffee',
      'Park': 'parks',
      'Hotel': 'lodging',
      'Motel': 'lodging',
      'AirBnB': 'lodging',
      'Historical Site': 'landmark',
      'Beach': 'beach',
      'Bar': 'bars',
      'Shopping': 'shopping',
      'Airport': 'airport',
      'Train Station': 'rail',
      'Cable Railway': 'rail',
      'Mountain': 'mountains',
      'Lake': 'water',
      'Zoo': 'parks',
      'Amusement Park': 'play',
      'Waterfall': 'water',
      'Town': 'homegardenbusiness',
      'Village': 'homegardenbusiness',
      'Market': 'shopping',
      'Therme': 'swimming',
      'Parking': 'parking',
      'Factory': 'mechanic'
    }
  };

  // KML style generation helpers
  const kmlHelpers = {
    getIconName: (type) => KML_STYLES.icons[type] || 'target',
    
    createTypeStyle: (type) => {
      const safeType = type.replace(/\s+/g, '');
      const iconName = kmlHelpers.getIconName(type);
      return {
        id: `icon-${safeType}`,
        icon: `http://maps.google.com/mapfiles/kml/shapes/${iconName}.png`
      };
    },

    generateTypeStyles: () => {
      const styles = {};
      Object.keys(typeIcons).forEach(type => {
        styles[type] = kmlHelpers.createTypeStyle(type);
      });
      return styles;
    }
  };

  // Generate all type styles
  const typeStyles = kmlHelpers.generateTypeStyles();

  // Helper function to generate style XML
  const generateStyleXML = (style) => {
    const normalStyle = `
    <Style id="${style.id}-normal">
      <IconStyle>
        ${style.color ? `<color>${style.color}</color>` : ''}
        <scale>1</scale>
        <Icon>
          <href>${style.icon}</href>
        </Icon>
        ${style.id === 'icon-1899-DB4436' ? '<hotSpot x="32" xunits="pixels" y="64" yunits="insetPixels"/>' : ''}
      </IconStyle>
      <LabelStyle>
        <scale>0</scale>
      </LabelStyle>
    </Style>`;

    const highlightStyle = `
    <Style id="${style.id}-highlight">
      <IconStyle>
        ${style.color ? `<color>${style.color}</color>` : ''}
        <scale>1</scale>
        <Icon>
          <href>${style.icon}</href>
        </Icon>
        ${style.id === 'icon-1899-DB4436' ? '<hotSpot x="32" xunits="pixels" y="64" yunits="insetPixels"/>' : ''}
      </IconStyle>
      <LabelStyle>
        <scale>1</scale>
      </LabelStyle>
    </Style>`;

    const styleMap = `
    <StyleMap id="${style.id}">
      <Pair>
        <key>normal</key>
        <styleUrl>#${style.id}-normal</styleUrl>
      </Pair>
      <Pair>
        <key>highlight</key>
        <styleUrl>#${style.id}-highlight</styleUrl>
      </Pair>
    </StyleMap>`;

    return normalStyle + highlightStyle + styleMap;
  };

  // Generate KML header with styles
  //console.log('\n📄 Generating KML styles:');
  //console.log('  → Adding default style');
  //console.log('  → Adding historical style');
  
  const typeStylesXML = Object.values(typeStyles).map(style => {
    //console.log(`  → Adding type style: ${style.id}`);
    return generateStyleXML(style);
  }).join('\n');
  
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${listName || 'Saved Places'}</name>
    <description>Exported places with custom styles</description>
    ${generateStyleXML(KML_STYLES.map.default)}
    ${generateStyleXML(KML_STYLES.map.historical)}
    ${typeStylesXML}`;
  
  //console.log('\n📝 KML Header generated with all styles');

  // We don't need this section anymore as we're using KML_STYLES

  // Helper function to determine if a place is historical/cultural
  const isHistoricalPlace = (place) => {
    return place.name === 'Heidnische Kirche' || 
           place.type === 'Historical Site' || 
           place.type === 'Museum' || 
           place.name.toLowerCase().includes('kirche') ||
           place.name.toLowerCase().includes('schloss');
  };

  // Helper function to generate placemark XML
  const generatePlacemarkXML = (place) => {
    if (!place.latitude || !place.longitude) return ''; // Skip places without coordinates
    
    const icon = typeIcons[place.type] || "📌";
    
    // Determine which style to use
    let style;
    //console.log(`\n🔍 Processing place: "${place.name}"`, {
    //  type: place.type,
    //  isHistorical: isHistoricalPlace(place),
    //  hasTypeStyle: !!typeStyles[place.type]
    //});
    
    if (isHistoricalPlace(place)) {
      style = KML_STYLES.map.historical;
      logger.debug('Style selection', { place: place.name, style: 'historical' });
    } else if (typeStyles[place.type]) {
      style = typeStyles[place.type];
      logger.debug('Style selection', { place: place.name, style: `type:${place.type}` });
    } else {
      style = KML_STYLES.map.default;
      logger.debug('Style selection', { place: place.name, style: 'default' });
    }
    //console.log('  → Selected style:', style);
    
    const description = [
      `<strong>Type:</strong> ${place.type}`,
      place.website ? `<strong>Website:</strong> <a href="${place.website}">${place.website}</a>` : '',
      place.description || 'No description available'
    ].filter(Boolean).join('<br/><br/>');

    return `
    <Placemark>
      <name>${icon} ${place.name}</name>
      <description><![CDATA[${description}]]></description>
      <styleUrl>#${style.id}</styleUrl>
      <Point>
        <coordinates>${place.longitude},${place.latitude},0</coordinates>
      </Point>
    </Placemark>`;
  };

  const placemarks = enrichedPlaces.map(generatePlacemarkXML).filter(Boolean).join('\n');


  const kmlFooter = `
  </Document>
</kml>`;

  const kmlContent = kmlHeader + placemarks + kmlFooter;

  // Create download functionality
  const downloadKml = () => {
    console.log('🔄 Starting KML download process');
    logger.debug('Starting KML download', { contentLength: kmlContent.length });
    
    // Create the blob and URL
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    
    // Create and configure download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storage.listName || 'SavedPlaces'}_enriched.kml`;
    link.style.display = 'none';
    
    // Add to document, click, and clean up
    document.body.appendChild(link);
    link.click();
    
    // Clean up after a short delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('✅ KML file download initiated');
      logger.info('✅ KML file download initiated');
    }, 100);
  };

  // Show results
  const successfulEnrichments = enrichedPlaces.filter(p => p.type !== "Unknown").length;
  const totalPlaces = enrichedPlaces.length;
  
  statusDiv.innerHTML = `✅ Processing complete!`;
  resultsDiv.innerHTML = `
    <div style="background: #4CAF50; color: white; padding: 12px; border-radius: 4px; text-align: center; margin-bottom: 15px;">
      <strong>🎉 ${totalPlaces} places processed!</strong><br>
      <small>${successfulEnrichments} places enriched with AI descriptions</small>
    </div>

    <div style="background: #fff3e0; padding: 12px; border-radius: 4px; margin-bottom: 15px; font-size: 12px; line-height: 1.4;">
      <strong>📋 How to import:</strong><br>
      1. Click "Download KML" below<br>
      2. In My Maps, click "Import"<br>
      3. Select the downloaded KML file<br>
      4. Done! All places will be imported with custom icons and formatting
    </div>

    <button id="downloadBtn" style="background: #2196F3; color: white; border: none; padding: 12px 20px; border-radius: 4px; font-size: 14px; cursor: pointer; width: 100%; margin-bottom: 10px;">
      📥 Download KML File
    </button>

    <div style="border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #f9f9f9;">
      <strong>✨ Features:</strong><br>
      <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
        <li>Custom icons for different place types</li>
        <li>Formatted descriptions with links</li>
        <li>Precise positioning from Google Maps</li>
      </ul>
      <div style="margin-top: 8px; font-size: 11px; color: #666;">
        <strong>Note:</strong> Coordinates extracted from Google Maps for precise positioning.
        ${enrichedPlaces.filter(p => p.latitude && p.longitude).length} of ${enrichedPlaces.length} places have coordinates.
      </div>
    </div>
  `;

  // Add download functionality
  const downloadBtn = resultsDiv.querySelector('#downloadBtn');
  if (!downloadBtn) {
    logger.warn('Download button not found in the UI');
    return;
  }

  downloadBtn.addEventListener('click', () => {
    try {
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = '⏳ Generating KML file...';
      
      // Execute download in a setTimeout to ensure UI updates
      setTimeout(() => {
        try {
          downloadKml();
          downloadBtn.innerHTML = '✅ Downloaded! Import into My Maps';
          downloadBtn.style.background = '#4CAF50';
        } catch (error) {
          logger.warn('Failed to download KML:', error);
          downloadBtn.innerHTML = '❌ Failed - Try Again';
          downloadBtn.style.background = '#f44336';
          alert('Failed to download KML file. Please try again.');
        } finally {
          downloadBtn.disabled = false;
        }
      }, 100);
    } catch (error) {
      logger.warn('Failed to handle click:', error);
      downloadBtn.disabled = false;
    }
  });

  const placesWithCoords = enrichedPlaces.filter(p => p.latitude && p.longitude).length;
  logger.info("🎉 KML generation complete!");
  logger.info(`📊 Generated KML file with ${placesWithCoords} places`);
  logger.debug('Final statistics', {
    totalPlaces: enrichedPlaces.length,
    placesWithCoordinates: placesWithCoords,
    uniqueTypes: [...new Set(enrichedPlaces.map(p => p.type))],
    placesWithWebsites: enrichedPlaces.filter(p => p.website).length,
    placesWithDescriptions: enrichedPlaces.filter(p => p.description).length
  });
  } catch (error) {
    console.error('❌ Fatal error:', error);
    // Try to show error in UI if possible
    try {
      if (statusDiv) {
        statusDiv.innerHTML = `❌ Error: ${error.message}`;
        statusDiv.style.color = '#f44336';
      }
    } catch (e) {
      // Ignore UI errors at this point
    }
  }
})();