import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
// Dynamically import puppeteer based on environment
// Use puppeteer-core in production (Vercel), standard puppeteer locally
const puppeteer = process.env.NODE_ENV === 'production' 
  ? require('puppeteer-core') 
  : require('puppeteer');
const chromium = process.env.NODE_ENV === 'production' 
  ? require('@sparticuz/chromium') 
  : null; // Only needed in production
// import puppeteer from "puppeteer-core"; // Changed from 'puppeteer'
// import chromium from "@sparticuz/chromium"; // Only needed in production
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Convert the logo file to a base64 data URL
function getLogoAsBase64() {
  try {
    // Try to read the logo from the public directory
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (error) {
    console.error("Error loading logo:", error);
    // Return a fallback in case the file can't be read
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("PDF generation API route starting");
    
    // 1. Parse the request body to get the briefingId
    const { briefingId } = await request.json();
    
    if (!briefingId) {
      console.error("No briefingId provided in request");
      return NextResponse.json({ error: "Briefing ID is required" }, { status: 400 });
    }

    console.log(`Processing request for briefingId: ${briefingId}`);

    // 2. Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("No valid authorization header found");
      return NextResponse.json({ error: "Unauthorized - No valid token" }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // 3. Create a new Supabase client with the provided token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    // 4. Fetch the briefing data from Supabase
    const { data: briefing, error: briefingError } = await supabase
      .from("briefings")
      .select("*, idea:ideas(name)")
      .eq("id", briefingId)
      .single();
    
    if (briefingError || !briefing) {
      console.error("Error fetching briefing:", briefingError);
      return NextResponse.json(
        { error: "Failed to fetch briefing data" },
        { status: 500 }
      );
    }

    console.log("Successfully fetched briefing data, generating PDF...");

    // Get the logo as base64
    const logoBase64 = getLogoAsBase64();

    // 5. Create HTML content with styling
    const htmlContent = generateHtml(briefing, logoBase64);

    console.log("Launching Puppeteer with enhanced configuration...");
    
    // 6. Generate PDF using Puppeteer with robust configuration for serverless
    try {
      // Configuration for Puppeteer with @sparticuz/chromium
      // const browser = await puppeteer.launch({
      //   args: chromium.args,
      //   defaultViewport: chromium.defaultViewport,
      //   executablePath: await chromium.executablePath(),
      //   headless: chromium.headless, // Use chromium.headless for better compatibility
      //   // ignoreHTTPSErrors: true, // Recommended by @sparticuz/chromium - Removed due to TS error
      // });
      
      // Updated configuration for both local dev and production
      let browser;
      if (process.env.NODE_ENV === 'production') {
        // Production (Vercel) configuration
        browser = await puppeteer.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless, 
          ignoreHTTPSErrors: true, // Safe to use here as require bypasses strict TS checks
        });
      } else {
        // Local development configuration
        browser = await puppeteer.launch({ 
          headless: true 
          // Use the bundled Chromium in puppeteer package
        }); 
      }
      
      console.log("Browser launched successfully");
      
      const page = await browser.newPage();
      console.log("Browser page created");
      
      // Set the content of the page
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      console.log("Page content set");
      
      // Generate PDF buffer
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      console.log("PDF generated successfully");
      
      // 7. Create a filename for the PDF download
      const ideaName = briefing.idea?.name || 'Briefing';
      const safeIdeaName = ideaName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Briefing_Note_${safeIdeaName}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Make sure to close the browser to free resources
      await browser.close();
      console.log("Browser closed");
      
      // 8. Return the PDF with appropriate headers for download
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } catch (puppeteerError: any) {
      console.error("Puppeteer specific error:", puppeteerError);
      return NextResponse.json(
        { error: `Puppeteer error: ${puppeteerError.message}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

// Helper function to generate HTML content with styling
function generateHtml(briefing: any, logoBase64: string) {
  // Extract idea name
  const ideaName = briefing.idea?.name || 'Unknown Idea';
  
  // Format dates
  const dateFrom = new Date(briefing.date_from).toLocaleDateString();
  const dateTo = new Date(briefing.date_to).toLocaleDateString();
  const createdAt = new Date(briefing.created_at).toLocaleDateString();
  
  // Generate the HTML content with embedded styles
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Briefing Note: ${ideaName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color: #e1e1e1;
          background-color: #1a1a1a;
          padding: 30px;
          margin: 0;
        }
        .briefing-container {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #333;
          border-radius: 10px;
          padding: 30px;
          background-color: #1f1f1f;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 25px;
          border-bottom: 1px solid #333;
          padding-bottom: 15px;
        }
        .idea-name {
          display: inline-block;
          background-color: rgba(22, 163, 74, 0.1);
          color: #4ade80;
          border: 1px solid #155724;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 14px;
          margin-top: 8px;
        }
        .date-info {
          color: #aaa;
          font-size: 14px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #f3f3f3;
        }
        .content-box {
          background-color: rgba(31, 31, 31, 0.5);
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
        }
        .detail-item {
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }
        .detail-item:last-child {
          border-bottom: none;
        }
        .source-link {
          color: #4ade80;
          font-size: 14px;
          text-decoration: none;
        }
        .attributes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 25px;
        }
        .attribute-tag {
          background-color: rgba(128, 128, 128, 0.1);
          color: #aaa;
          border: 1px solid #444;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
        }
        .next-step-item {
          background-color: rgba(59, 130, 246, 0.1);
          color: #93c5fd;
          border: 1px solid #1e3a8a;
          border-radius: 8px;
          padding: 12px 15px;
          margin-bottom: 10px;
          display: flex;
          align-items: flex-start;
        }
        .next-step-item:before {
          content: "→";
          margin-right: 10px;
          color: #3b82f6;
        }
        .suggested-signal {
          background-color: rgba(234, 179, 8, 0.1);
          color: #fde047;
          border: 1px solid #713f12;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 14px;
          margin-right: 8px;
          margin-bottom: 8px;
          display: inline-block;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #333;
          color: #aaa;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .footer img {
          height: 24px;
          margin-left: 6px;
        }
      </style>
    </head>
    <body>
      <div class="briefing-container">
        <div class="header">
          <div>
            <h1 style="margin-top: 0; margin-bottom: 10px; font-size: 24px;">Environment Briefing Note</h1>
            <div class="date-info">Period: ${dateFrom} - ${dateTo}</div>
            <div class="idea-name">${ideaName}</div>
          </div>
          <div class="date-info">
            Created: ${createdAt}
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Summary</div>
          <div class="content-box">
            ${briefing.summary}
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Details</div>
          <div class="content-box">
            ${briefing.details.map((detail: any) => `
              <div class="detail-item">
                <div style="margin-bottom: 10px;">
                  <span style="margin-right: 8px;">${detail.emoji}</span>
                  ${detail.summary}
                </div>
                <div>
                  <span style="color: #aaa; font-size: 14px;">Source: </span>
                  <a href="${detail.url}" class="source-link">
                    ${detail.source_name || extractDomainFromUrl(detail.url)}
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        ${briefing.next_steps && briefing.next_steps.length > 0 ? `
          <div class="section">
            <div class="section-title">Recommended Next Steps</div>
            <div>
              ${briefing.next_steps.map((step: string) => `
                <div class="next-step-item">${step}</div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${briefing.suggested_signals && briefing.suggested_signals.length > 0 ? `
          <div class="section">
            <div class="section-title">Suggested New Idea Attributes</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${briefing.suggested_signals.map((signal: string) => `
                <div class="suggested-signal">${signal}</div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="section">
          <div class="section-title" style="color: #aaa; font-size: 14px;">Key Attributes Used for This Briefing</div>
          <div class="attributes">
            ${briefing.key_attributes.map((attribute: string) => `
              <div class="attribute-tag">${attribute}</div>
            `).join('')}
          </div>
        </div>
        
        <div class="footer">
          Generated by <img src="${logoBase64}" alt="Macy Logo" />
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to extract domain from URL for display in the source
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, "").split(".");
    if (domain.length >= 2) {
      // Capitalize first letter of domain name
      return (
        domain[domain.length - 2].charAt(0).toUpperCase() +
        domain[domain.length - 2].slice(1)
      );
    }
    return urlObj.hostname.replace(/^www\./, "");
  } catch (e) {
    return "Source";
  }
} 