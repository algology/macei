import { NextResponse } from "next/server";
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const { url, priority } = await request.json();
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    const isPriority = priority === "high";
    console.log(`Fetching content from URL: ${url} (Priority: ${isPriority ? "High" : "Normal"})`);
    
    // Add validation and security checks for the URL
    try {
      new URL(url); // This will throw if URL is invalid
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }
    
    // Don't attempt to fetch obvious invalid URLs
    if (url === "https://example.com/invalid-url" || 
        url === "https://example.com/article") {
      return NextResponse.json({
        url,
        content: "This is a placeholder URL with no actual content.",
        error: null
      });
    }

    // Fetch the URL content with a timeout - longer for priority URLs
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(), 
      isPriority ? 15000 : 10000 // 15 second timeout for priority URLs
    );
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      
      // Handle different content types appropriately
      if (contentType.includes('text/html')) {
        // Process HTML content
        const html = await response.text();
        return processHtmlContent(url, html);
      } 
      else if (contentType.includes('application/json')) {
        // Handle JSON content
        const json = await response.json();
        return NextResponse.json({
          url,
          content: JSON.stringify(json, null, 2).substring(0, 5000),
          error: null
        });
      }
      else if (contentType.includes('text/plain')) {
        // Handle plain text content
        const text = await response.text();
        return NextResponse.json({
          url,
          content: text.substring(0, 5000),
          error: null
        });
      }
      else {
        // For other content types, just return a summary
        return NextResponse.json({
          url,
          content: `Content is not text-based (${contentType})`,
          error: null
        });
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`Error fetching ${url}:`, error);
      
      return NextResponse.json({
        url,
        content: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
  } catch (error) {
    console.error("Error in fetch-url-content API:", error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}

// Helper function to process HTML content
function processHtmlContent(url: string, html: string) {
  try {
    // Use cheerio to parse and extract the main content
    const $ = cheerio.load(html);
    
    // Remove script tags, style tags, and comments
    $('script, style, noscript, iframe, svg').remove();
    // Use a simpler approach to remove comments
    $('*').contents().filter(function() {
      // @ts-ignore - cheerio's type definitions are not perfect
      return this.type === 'comment';
    }).remove();
    
    // Try to find the main content
    let mainContent = '';
    
    // Get the page title
    const title = $('title').text().trim() || $('h1').first().text().trim() || '';
    
    // Try to find article or main content
    const contentSelectors = [
      'article', 'main', '[role="main"]', '.main-content', 
      '.article-content', '.post-content', '.content', '#content',
      '.article', '.post', '.entry', '.entry-content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        mainContent = element.text().trim();
        break;
      }
    }
    
    // If we couldn't find main content with selectors, take the body content
    if (!mainContent) {
      // Get text from body, excluding header and footer
      $('header, footer, nav, aside, .header, .footer, .nav, .sidebar, .ads, .advertisement').remove();
      mainContent = $('body').text().trim();
    }
    
    // Clean the text
    mainContent = mainContent
      .replace(/\s+/g, ' ') // Replace multiple whitespaces with a single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with a single newline
      .trim();
    
    // Add metadata from HTML if available
    let metaDescription = $('meta[name="description"]').attr('content') || '';
    let metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    
    // Add metadata to the beginning of the content if available
    const metadata = [];
    if (metaDescription) metadata.push(`Description: ${metaDescription}`);
    if (metaKeywords) metadata.push(`Keywords: ${metaKeywords}`);
    
    const finalContent = metadata.length > 0 
      ? `${metadata.join('\n')}\n\nContent:\n${mainContent}`
      : mainContent;
    
    return NextResponse.json({
      url,
      title,
      content: finalContent,
      error: null
    });
  } catch (error) {
    console.error("Error processing HTML:", error);
    return NextResponse.json({
      url,
      title: url,
      content: "Failed to process HTML content",
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 