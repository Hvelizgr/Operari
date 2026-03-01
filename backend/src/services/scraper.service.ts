import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger } from './logger.service';
import { SecurityService } from './security.service';

export interface ScrapeOptions {
  mode: 'fast' | 'advanced';
  selector?: string;
  extractText?: boolean;
  extractHtml?: boolean;
  extractLinks?: boolean;
  extractImages?: boolean;
}

export interface ScrapeResult {
  url: string;
  mode: string;
  title?: string;
  text?: string;
  html?: string;
  markdown?: string;
  links?: string[];
  images?: string[];
  metadata?: Record<string, any>;
}

export class ScraperService {
  private static instance: ScraperService;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ScraperService {
    if (!ScraperService.instance) {
      ScraperService.instance = new ScraperService();
    }
    return ScraperService.instance;
  }

  /**
   * Main scrape method
   */
  public async scrape(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
    if (!SecurityService.isSafeUrl(url)) {
      throw new Error(`Access to URL is blocked for security reasons (SSRF Protection): ${url}`);
    }

    try {
      if (options.mode === 'advanced') {
        return await this.scrapeAdvanced(url);
      } else {
        return await this.scrapeFast(url, options);
      }
    } catch (error) {
      this.logger.error(`Scraping failed for ${url}:`, { error: error as Error });
      throw error;
    }
  }

  /**
   * Fast mode: Uses axios + cheerio for static content
   */
  private async scrapeFast(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'NanoFlow-Bot/1.0 (+https://nanoflow.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const result: ScrapeResult = {
      url,
      mode: 'fast',
      title: $('title').text() || $('meta[property="og:title"]').attr('content'),
    };

    const target = options.selector ? $(options.selector) : $('body');

    if (options.extractText !== false) {
      result.text = target.text().replace(/\s+/g, ' ').trim();
    }

    if (options.extractHtml) {
      result.html = target.html() || '';
    }

    if (options.extractLinks) {
      const links = new Set<string>();
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          try {
            links.add(new URL(href, url).toString());
          } catch {
            links.add(href);
          }
        }
      });
      result.links = Array.from(links);
    }

    if (options.extractImages) {
      const images = new Set<string>();
      $('img[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          try {
            images.add(new URL(src, url).toString());
          } catch {
            images.add(src);
          }
        }
      });
      result.images = Array.from(images);
    }

    return result;
  }

  /**
   * Advanced mode: Uses Jina AI Reader API (r.jina.ai)
   * Excellent for LLM context, clean markdown, and handles modern JS better.
   */
  private async scrapeAdvanced(url: string): Promise<ScrapeResult> {
    // Jina AI Reader is a public utility that converts any URL to LLM-friendly markdown
    const readerUrl = `https://r.jina.ai/${url}`;
    
    const response = await axios.get(readerUrl, {
      headers: {
        'X-Return-Format': 'markdown',
      },
      timeout: 30000,
    });

    // Jina Reader usually returns the markdown directly or a JSON if requested
    // We assume markdown for now as it's the most valuable for LLM-integrated workflows
    return {
      url,
      mode: 'advanced',
      markdown: response.data,
      text: response.data, // Fallback text is the markdown itself
    };
  }
}
