# PromptlyAgent Knowledge Clipper

A Chrome extension for saving web pages and articles directly to your PromptlyAgent knowledge system. Extract content, add annotations, tag pages, and build your personal knowledge base effortlessly.

## Features

- **Smart Content Extraction**: Uses Mozilla's Readability library to extract clean, readable content from web pages
- **Text Selection Support**: Save just the text you select or the entire page
- **Custom Annotations**: Add personal notes and comments to saved articles
- **Tagging System**: Organize knowledge with tags
- **Privacy Control**: Choose between private and public documents
- **Screenshot Capture**: Optionally capture page screenshots
- **TTL Support**: Set expiration dates for temporary documents
- **Secure Authentication**: Uses Laravel Sanctum API tokens

## Installation

### Method 1: Developer Mode (Recommended for Testing)

1. **Clone or download** this extension:
   ```bash
   git clone git@github.com:promptlyagentai/chrome-extension.git
   cd chrome-extension
   ```

2. **Open Chrome Extensions**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load the extension**:
   - Click "Load unpacked"
   - Select the `chrome-extension/` directory
   - The extension icon should appear in your toolbar

### Method 2: Chrome Web Store (Future)

_The extension will be available on the Chrome Web Store once published._

## Configuration

### Step 1: Generate API Token

1. **Navigate to your PromptlyAgent settings**:
   - Open your PromptlyAgent application
   - Go to **Settings → API Tokens**

2. **Create a new token**:
   - Enter a name (e.g., "Chrome Extension")
   - Select the **`knowledge:create`** scope
   - Click "Generate Token"
   - **Copy the token** (you won't see it again!)

### Step 2: Configure Extension

1. **Click the extension icon** in your Chrome toolbar

2. **Enter configuration**:
   - **API URL**: Your PromptlyAgent application URL (e.g., `https://your-domain.com`)
   - **API Token**: Paste the token you copied

3. **Save Configuration**:
   - Click "Save Configuration"
   - The extension will validate your token
   - Once validated, you're ready to save pages!

## Usage

### Saving a Web Page

1. **Browse to any article or page** you want to save

2. **Click the extension icon**

3. **Review and edit** the extracted information:
   - **Title**: Pre-filled from page, editable
   - **Description**: From meta tags, editable
   - **Custom Notes**: Add your thoughts and annotations
   - **Tags**: Organize with comma-separated tags
   - **Privacy**: Choose Private or Public
   - **Screenshot**: Check to capture page screenshot
   - **TTL**: Optionally set expiration time

4. **Click "Save to Knowledge"**

5. **Success!** The page is now in your knowledge system

### Saving Selected Text

1. **Select text** on any webpage

2. **Click the extension icon**

3. **The selected text** will be used as the primary content

4. **Edit and save** as usual

## Features Explained

### Content Extraction

The extension uses **Mozilla's Readability library** to extract clean content from web pages:
- Removes ads, navigation, and clutter
- Preserves article structure
- Extracts metadata (title, author, date)

### Tagging

Organize your knowledge with tags:
- Enter tags separated by commas: `technology, programming, laravel`
- Tags are automatically created if they don't exist
- Use consistent tags for better organization

### Privacy Levels

- **Private**: Only you can see this knowledge
- **Public**: Can be shared or made visible to others (based on your PromptlyAgent settings)

### Time to Live (TTL)

Set automatic expiration for temporary documents:
- **1 day**: Quick references
- **1 week**: Short-term research
- **1 month**: Project-specific content
- **Custom**: Choose your own duration
- **Keep forever**: No expiration (default)

### Screenshots

Optionally capture page screenshots:
- Captures visible portion of the page
- Stored with the knowledge document
- Useful for design references or visual content

## Keyboard Shortcuts

_Future feature: Configurable keyboard shortcuts for quick saving_

## Troubleshooting

### Extension doesn't extract content

**Problem**: Content preview shows "No content extracted"

**Solutions**:
- Refresh the page and try again
- Some pages block content extraction (JavaScript-heavy SPAs)
- Try selecting text manually and saving the selection

### Token validation fails

**Problem**: "Invalid token" error when configuring

**Solutions**:
- Verify the token has `knowledge:create` scope
- Check that your API URL is correct (include `https://`)
- Ensure your PromptlyAgent instance is running and accessible
- Try regenerating the token

### CORS errors in console

**Problem**: "CORS policy" errors in browser console

**Solutions**:
- Ensure CORS is configured in your PromptlyAgent instance
- Check `config/cors.php` includes Chrome extension patterns
- Restart your application after CORS changes

### Save fails with 403 error

**Problem**: "Permission denied" when saving

**Solutions**:
- Token must have `knowledge:create` scope
- Regenerate token with correct permissions
- Check token hasn't expired

### Content is too long

**Problem**: Validation error about content length

**Solutions**:
- The API has a 1MB limit for text content
- Try saving selected portions instead of entire page
- Very long articles may need to be split

## Development

### Project Structure

```
chrome-extension/
├── manifest.json              # Extension manifest (Manifest V3)
├── popup.html                 # Popup interface
├── popup.js                   # Popup logic
├── popup.css                  # Styling
├── background.js              # Service worker
├── content-script.js          # Content extraction
├── screenshot.js              # Screenshot capture
├── api-client.js              # API communication
├── storage.js                 # Chrome storage wrapper
├── lib/
│   ├── readability.js        # Mozilla Readability library
│   └── turndown.js           # HTML to Markdown converter
└── icons/
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

### Building for Production

1. **Optimize assets**:
   ```bash
   # Minify JavaScript (optional)
   # Optimize images
   # Remove development files
   ```

2. **Create ZIP for distribution**:
   ```bash
   cd chrome-extension
   zip -r promptlyagent-clipper.zip . -x "*.git*" -x "README.md"
   ```

### Testing

1. **Load in Developer Mode** (see Installation)

2. **Test various pages**:
   - News articles
   - Blog posts
   - Documentation pages
   - Single-page applications

3. **Test text selection**:
   - Select partial text
   - Save selection

4. **Test all form options**:
   - Tags, privacy, TTL
   - Screenshots
   - Custom notes

## Browser Compatibility

- **Chrome**: Fully supported (v88+)
- **Edge**: Supported (Chromium-based)
- **Brave**: Supported (Chromium-based)
- **Firefox**: Not yet supported (needs manifest conversion)

## Privacy & Security

- **API tokens** are stored securely in Chrome's encrypted storage
- **Content** is sent directly to your PromptlyAgent instance
- **No third-party services** are used
- **No tracking or analytics**

## Support

For issues or questions:

1. **Check this README** for troubleshooting tips
2. **Review browser console** for error messages
3. **Check PromptlyAgent logs** on the server
4. **Open an issue** in the project repository

## License

This extension is part of the PromptlyAgent project and shares the same license.

## Changelog

### Version 1.0.0 (Initial Release)
- Smart content extraction with Readability
- Text selection support
- Custom notes and annotations
- Tagging system
- Privacy controls
- Screenshot capture
- TTL support
- Secure API token authentication
