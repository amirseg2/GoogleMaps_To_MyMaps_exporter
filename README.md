# Google Maps to My Maps Sync Extension

A Chrome extension that exports saved places from Google Maps and imports them to Google My Maps with AI-powered enrichment, custom icons, and structured formatting.

## 🚀 Features

- **Export Places**: Extract saved places from Google Maps lists with coordinates, names, and metadata
- **AI Enrichment**: Automatically categorize places and generate descriptions using OpenAI GPT-4
- **Custom Icons**: Generate KML files with type-specific icons for different place categories
- **Bulk Processing**: Process multiple places efficiently with parallel API calls
- **Multi-language Support**: Generate descriptions in Hebrew or English
- **Progress Tracking**: Real-time progress updates with detailed logging

## 📋 Supported Place Types

The extension categorizes places into the following types with custom icons:

| Type | Icon | Type | Icon |
|------|------|------|------|
| Museum | 🏛️ | Restaurant | 🍽️ |
| Cafe | ☕ | Park | 🌳 |
| Hotel | 🏨 | Historical Site | 🏰 |
| Beach | 🏖️ | Bar | 🍸 |
| Shopping | 🛍️ | Airport | ✈️ |
| Train Station | 🚉 | Mountain | ⛰️ |
| Lake | 🏞️ | Zoo | 🦁 |
| Amusement Park | 🎢 | Waterfall | 💧 |
| Town/Village | 🏘️ | Market | 🛒 |
| Therme | ♨️ | Parking | 🅿️ |
| Factory | 🏭 | Unknown | 📌 |

## 🛠 Installation

### Prerequisites
- Google Chrome browser
- OpenAI API key (get one from [OpenAI Platform](https://platform.openai.com/api-keys))

### Install the Extension

1. **Download the Extension**
   - Clone or download this repository to your local machine

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension icon should appear in your Chrome toolbar

4. **Configure Settings**
   - Click the extension icon to open the popup
   - Enter your OpenAI API key
   - Select your preferred language (Hebrew/English)
   - Click "Save Settings"

## 📖 How to Use

### Step 1: Export Places from Google Maps

1. **Navigate to Google Maps**
   - Go to [maps.google.com](https://maps.google.com)
   - Sign in to your Google account

2. **Open a Saved List**
   - Click the menu (☰) → "Your places" → "Saved"
   - Select any saved list (e.g., "Want to go", "Favorites", or custom lists)
   - Make sure the list view is open with all places visible

3. **Export Places**
   - Click the extension icon in Chrome toolbar
   - Click "📤 Export from Google Maps"
   - The extension will automatically:
     - Scroll through the list to load all places
     - Extract place names, coordinates, and metadata
     - Save the data locally in Chrome storage

4. **Verify Export**
   - The popup will show: "📍 X place(s) ready for import"
   - It will display the list name and export date

### Step 2: Import to My Maps

1. **Open Google My Maps**
   - Go to [mymaps.google.com](https://mymaps.google.com)
   - Create a new map or open an existing one
   - Make sure you're in the map editor

2. **Generate KML File**
   - Click the extension icon
   - Click "📥 Import to My Maps"
   - A progress panel will appear showing:
     - AI enrichment progress for each place
     - Type classification and description generation
     - KML file preparation

3. **Download and Import**
   - When processing is complete, click "📥 Download KML File"
   - In My Maps, click "Import"
   - Select the downloaded KML file
   - All places will be imported with custom icons and formatting

## 🔧 Configuration Options

### Debug Mode
Enable detailed logging by modifying `CONFIG.debug.enabled` in `content-mymaps.js`:
```javascript
const CONFIG = {
  debug: {
    enabled: true,  // Set to true for detailed logs
    logOpenAIRequests: true  // Set to true to log API requests/responses
  }
}
```

### Testing Mode
Limit AI processing to first 5 places for testing:
```javascript
const CONFIG = {
  testing: {
    enabled: true,  // Enable testing mode
    placesLimit: 5  // Number of places to process with AI
  }
}
```

### Processing Settings
Adjust parallel processing and timing:
```javascript
const CONFIG = {
  processing: {
    concurrentLimit: 5,      // Max parallel API calls
    delayBetweenRequests: 200,  // Delay between requests (ms)
    delayBetweenBatches: 1000   // Delay between batches (ms)
  }
}
```

## 🔄 Complete Workflow

### Export Phase
1. **Page Detection**: Verifies you're on a Google Maps page
2. **Sidebar Discovery**: Automatically finds the places list container
3. **Auto-scrolling**: Scrolls through the entire list to load all places
4. **Data Extraction**: Extracts place data including:
   - Name and address
   - Coordinates (latitude/longitude)
   - Any additional metadata
5. **Storage**: Saves extracted data to Chrome local storage

### Import Phase
1. **Page Verification**: Confirms you're on Google My Maps editor
2. **Data Validation**: Checks for valid exported places data
3. **AI Enrichment**: For each place:
   - Sends place name to OpenAI GPT-4
   - Requests type classification from supported categories
   - Generates description in selected language
   - Extracts official website if available
4. **KML Generation**: Creates KML file with:
   - Custom styles for each place type
   - Google Maps-compatible icons
   - Structured descriptions with type, website, and description
   - Precise coordinate positioning
5. **Download**: Generates downloadable KML file for My Maps import

## 🎛 User Interface Screens

### Main Popup
- **Places Info Panel**: Shows exported places count, list name, and export date
- **Action Buttons**: Export, Import, and Clear Data
- **Settings Section**: OpenAI API key and language preference
- **Status Messages**: Real-time feedback for all operations

### Export Progress
- Appears during Google Maps export
- Shows scrolling progress and places discovered
- Auto-closes when export completes

### Import Progress Panel
- **Header**: Shows list name and processing mode (normal/testing)
- **Info Section**: Explains the AI enrichment process
- **Progress Bar**: Visual progress indicator
- **Status Text**: Current operation and place being processed
- **Results Section**: Final statistics and download button
- **Close Button**: Allows manual panel closure

## 🔍 Troubleshooting

### Common Issues

**Export Problems:**
- Ensure you're on a Google Maps saved list page
- Make sure the list is fully loaded and visible
- Try refreshing the page and waiting for content to load

**Import Problems:**
- Verify you're on Google My Maps editor (not viewer)
- Check that your OpenAI API key is valid
- Ensure you have sufficient OpenAI API credits

**API Issues:**
- Check browser console for detailed error messages
- Verify internet connection
- Try reducing concurrent limit in testing mode

### Debug Mode
Enable debug mode to see detailed logs:
1. Open browser DevTools (F12)
2. Check Console tab for detailed processing logs
3. Look for error messages or API response details

## 📊 Output Format

### KML Structure
The generated KML file includes:
- Document header with list name
- Style definitions for all place types
- Placemark entries with:
  - Name with emoji icon
  - Structured description (type, website, description)
  - Custom style reference
  - Precise coordinates

### Place Description Format
Each place includes:
- **Type**: Categorized place type
- **Website**: Official website URL (if found)
- **Description**: 2-3 sentence AI-generated description

## 🔒 Privacy & Security

- **Local Storage**: All data is stored locally in Chrome storage
- **API Security**: OpenAI API key is stored locally and never transmitted to other servers
- **No External Dependencies**: Extension works offline except for OpenAI API calls
- **Minimal Permissions**: Only requests necessary Chrome permissions

## 🤝 Contributing

This extension is designed for personal use. To modify or enhance:

1. Edit the relevant files:
   - `content-scraper.js`: Google Maps data extraction
   - `content-mymaps.js`: AI enrichment and KML generation
   - `popup.js`: User interface logic
   - `popup.html`: UI structure and styling

2. Test changes by reloading the extension in Chrome developer mode

3. Consider contributing improvements back to the project

## 📄 License

This project is for educational and personal use. Please respect Google's Terms of Service when using their platforms.

---

**Made with ❤️ for seamless Google Maps to My Maps migration**