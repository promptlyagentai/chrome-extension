/**
 * Content Script for Page Data Extraction
 *
 * This script runs on web pages and extracts content using Mozilla's Readability library.
 * It captures metadata, main content, and selected text.
 */

/**
 * Extract metadata from page meta tags
 */
function getMetaContent(property) {
  const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
  return meta ? meta.getAttribute('content') : '';
}

/**
 * Get page description from meta tags
 */
function getMetaDescription() {
  return getMetaContent('og:description') ||
         getMetaContent('description') ||
         getMetaContent('twitter:description') ||
         '';
}

/**
 * Get page author from meta tags
 */
function getMetaAuthor() {
  return getMetaContent('author') ||
         getMetaContent('article:author') ||
         getMetaContent('og:article:author') ||
         '';
}

/**
 * Get publication date from meta tags
 */
function getMetaDate() {
  return getMetaContent('article:published_time') ||
         getMetaContent('date') ||
         getMetaContent('pubdate') ||
         '';
}

/**
 * Get page keywords from meta tags
 */
function getMetaKeywords() {
  const keywords = getMetaContent('keywords');
  return keywords ? keywords.split(',').map(k => k.trim()) : [];
}

/**
 * Get Open Graph image
 */
function getMetaImage() {
  return getMetaContent('og:image') ||
         getMetaContent('twitter:image') ||
         '';
}

/**
 * Get favicon URL
 */
function getFaviconUrl() {
  // Try multiple sources for favicon
  const iconLink = document.querySelector('link[rel="icon"]') ||
                   document.querySelector('link[rel="shortcut icon"]') ||
                   document.querySelector('link[rel="apple-touch-icon"]');

  if (iconLink && iconLink.href) {
    return iconLink.href;
  }

  // Fallback to default /favicon.ico
  return window.location.origin + '/favicon.ico';
}

/**
 * Get page title with fallbacks
 */
function getPageTitle() {
  return getMetaContent('og:title') ||
         getMetaContent('twitter:title') ||
         document.title ||
         '';
}

/**
 * Get selected text from page
 */
function getSelectedText() {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  return text;
}

/**
 * Extract main content using Readability and convert to Markdown
 */
function extractMainContent() {
  try {
    // Clone document for Readability (it modifies the DOM)
    const documentClone = document.cloneNode(true);

    // Remove scripts and styles from clone
    documentClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

    // Use Readability to extract article content
    const reader = new Readability(documentClone, {
      debug: false,
      maxElemsToParse: 0, // No limit
      nbTopCandidates: 5,
      charThreshold: 500,
    });

    const article = reader.parse();

    if (article) {
      // Convert HTML content to Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '_',
      });

      // Convert the HTML content to markdown
      const markdownContent = article.content
        ? turndownService.turndown(article.content)
        : article.textContent || '';

      return {
        title: article.title,
        content: markdownContent,
        excerpt: article.excerpt || '',
        byline: article.byline || '',
        length: markdownContent.length || 0,
        siteName: article.siteName || '',
      };
    }

    return null;
  } catch (error) {
    console.error('Readability extraction error:', error);
    return null;
  }
}

/**
 * Fallback content extraction (if Readability fails)
 */
function extractFallbackContent() {
  // Try to get main content from common semantic tags
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.innerText || element.textContent || '';
    }
  }

  // Ultimate fallback: get body text
  return document.body.innerText || document.body.textContent || '';
}

/**
 * Main extraction function
 */
function extractPageData() {
  const selectedText = getSelectedText();
  const hasSelection = selectedText.length > 0;

  // Extract using Readability
  const article = extractMainContent();

  // Prepare the result
  const result = {
    // Basic page info
    url: window.location.href,
    domain: window.location.hostname,
    title: getPageTitle(),

    // Content
    content: '',
    excerpt: '',

    // Selection
    selectedText: selectedText,
    hasSelection: hasSelection,

    // Metadata
    description: getMetaDescription(),
    author: getMetaAuthor() || (article ? article.byline : ''),
    publishedDate: getMetaDate(),
    keywords: getMetaKeywords(),
    ogImage: getMetaImage(),
    favicon: getFaviconUrl(),

    // Additional info
    contentLength: 0,
    siteName: article ? article.siteName : window.location.hostname,
  };

  // Determine content to use
  if (hasSelection) {
    // User has selected text - use that as primary content
    result.content = selectedText;
    result.excerpt = selectedText.substring(0, 300);
    result.contentLength = selectedText.length;
  } else if (article && article.content) {
    // Use Readability extracted content
    result.content = article.content;
    result.excerpt = article.excerpt || article.content.substring(0, 300);
    result.contentLength = article.length || article.content.length;

    // Override title if Readability found a better one
    if (article.title && article.title.length > 0) {
      result.title = article.title;
    }
  } else {
    // Readability extraction failed - notify user and use fallback
    chrome.runtime.sendMessage({
      action: 'showNotification',
      title: 'Content Extraction Notice',
      message: 'Using basic extraction. Page structure may not be optimized for reading.',
      type: 'info'
    });

    // Fallback extraction
    result.content = extractFallbackContent();
    result.excerpt = result.content.substring(0, 300);
    result.contentLength = result.content.length;
  }

  // Use description as excerpt if no excerpt yet
  if (!result.excerpt && result.description) {
    result.excerpt = result.description;
  }

  return result;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractPageData') {
    try {
      const pageData = extractPageData();
      sendResponse({ success: true, data: pageData });
    } catch (error) {
      console.error('Content extraction error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Keep message channel open for async response
});
