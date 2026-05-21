import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Tag, AlertCircle } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const buildExcerptFromContent = (content: string, fallback: string): string => {
  const stripped = decodeHtmlEntities(
    (content ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  const source = stripped.length > 0 ? stripped : (fallback ?? '');
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const MAX_WORDS = 20;
  if (words.length <= MAX_WORDS) return source;
  return `${words.slice(0, MAX_WORDS).join(' ')}\u2026`;
};
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { NewsArticle } from '@/types';

const NEWS_PAGE_URL = 'https://freedomfm1065.com/news/';
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://proxy.cors.sh/',
];

const stableIdFromLink = (link?: string): string => {
  const input = (link ?? '').trim();
  if (!input) return `news-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }

  const normalized = Math.abs(hash >>> 0).toString(36);
  return `news-${normalized}`;
};
const MAX_RETRIES = 2;
const NEWS_CACHE_KEY = 'freedomfm_news_cache_v3';
const NEWS_CACHE_TIME_KEY = 'freedomfm_news_cache_time_v3';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';

  const decodeOnce = (str: string): string => {
    let result = str;

    result = result.replace(/%26/g, '&');
    result = result.replace(/%23/g, '#');

    result = result.replace(/&amp;amp;amp;amp;/gi, '&');
    result = result.replace(/&amp;amp;amp;/gi, '&');
    result = result.replace(/&amp;amp;/gi, '&');

    result = result.replace(/&amp;nbsp;/gi, ' ');
    result = result.replace(/&amp;quot;/gi, '"');
    result = result.replace(/&amp;apos;/gi, "'");
    result = result.replace(/&amp;lt;/gi, '<');
    result = result.replace(/&amp;gt;/gi, '>');
    result = result.replace(/&amp;#(\d+);/gi, '&#$1;');
    result = result.replace(/&amp;#x([a-fA-F0-9]+);/gi, '&#x$1;');

    result = result.replace(/&#038;/g, '&');
    result = result.replace(/&#38;/g, '&');
    result = result.replace(/&#0?38;/g, '&');

    result = result.replace(/&amp;/gi, '&');
    result = result.replace(/&lt;/gi, '<');
    result = result.replace(/&gt;/gi, '>');
    result = result.replace(/&quot;/gi, '"');
    result = result.replace(/&#0?39;/g, "'");
    result = result.replace(/&#039;/g, "'");
    result = result.replace(/&apos;/gi, "'");

    result = result.replace(/&#8217;/g, "'");
    result = result.replace(/&#8216;/g, "'");
    result = result.replace(/&#8220;/g, '"');
    result = result.replace(/&#8221;/g, '"');
    result = result.replace(/&#8211;/g, '–');
    result = result.replace(/&#8212;/g, '—');
    result = result.replace(/&#8230;/g, '…');
    result = result.replace(/&#8218;/g, ',');
    result = result.replace(/&#8222;/g, '„');
    result = result.replace(/&#8242;/g, "'");
    result = result.replace(/&#8243;/g, '"');

    result = result.replace(/&hellip;/gi, '…');
    result = result.replace(/&ndash;/gi, '–');
    result = result.replace(/&mdash;/gi, '—');
    result = result.replace(/&lsquo;/gi, "'");
    result = result.replace(/&rsquo;/gi, "'");
    result = result.replace(/&ldquo;/gi, '"');
    result = result.replace(/&rdquo;/gi, '"');
    result = result.replace(/&nbsp;/gi, ' ');
    result = result.replace(/&copy;/gi, '©');
    result = result.replace(/&reg;/gi, '®');
    result = result.replace(/&trade;/gi, '™');
    result = result.replace(/&bull;/gi, '•');
    result = result.replace(/&middot;/gi, '·');
    result = result.replace(/&deg;/gi, '°');
    result = result.replace(/&pound;/gi, '£');
    result = result.replace(/&euro;/gi, '€');
    result = result.replace(/&cent;/gi, '¢');
    result = result.replace(/&yen;/gi, '¥');
    result = result.replace(/&sect;/gi, '§');
    result = result.replace(/&para;/gi, '¶');
    result = result.replace(/&frac12;/gi, '½');
    result = result.replace(/&frac14;/gi, '¼');
    result = result.replace(/&frac34;/gi, '¾');
    result = result.replace(/&times;/gi, '×');
    result = result.replace(/&divide;/gi, '÷');
    result = result.replace(/&plusmn;/gi, '±');

    result = result.replace(/&#(\d+);/g, (match, num) => {
      const code = parseInt(num, 10);
      if (code > 0 && code < 65536) return String.fromCharCode(code);
      return match;
    });

    result = result.replace(/&#x([a-fA-F0-9]+);/gi, (match, hex) => {
      const code = parseInt(hex, 16);
      if (code > 0 && code < 65536) return String.fromCharCode(code);
      return match;
    });

    result = result.replace(/\u00A0/g, ' ');

    return result;
  };

  let decoded = text;
  let previous = '';
  let iterations = 0;
  const maxIterations = 8;

  while (decoded !== previous && iterations < maxIterations) {
    previous = decoded;
    decoded = decodeOnce(decoded);
    iterations += 1;
  }

  return decoded;
};

const normalizeNewsArticle = (raw: unknown): NewsArticle | null => {
  try {
    const obj = raw as Partial<NewsArticle> & Record<string, unknown>;

    const link = typeof obj.link === 'string' ? obj.link : undefined;
    const id = typeof obj.id === 'string' && obj.id.trim().length > 0 ? obj.id : stableIdFromLink(link);
    const title = typeof obj.title === 'string' ? obj.title : '';
    const excerpt = typeof obj.excerpt === 'string' ? obj.excerpt : title;
    const imageUrl =
      typeof obj.imageUrl === 'string' && obj.imageUrl.length > 0
        ? obj.imageUrl
        : 'https://freedomfm1065.com/wp-content/uploads/2024/01/freedom-fm-logo.png';
    const date = typeof obj.date === 'string' && obj.date.length > 0 ? obj.date : '';
    const category = typeof obj.category === 'string' && obj.category.length > 0 ? obj.category : 'News';
    const content = typeof obj.content === 'string' ? obj.content : '';

    if (!title || title.trim().length < 3) return null;

    return {
      id,
      title,
      excerpt,
      imageUrl,
      date,
      category,
      content,
      link,
    } satisfies NewsArticle;
  } catch (e) {
    console.log('[NEWS] normalizeNewsArticle error:', (e as any)?.message);
    return null;
  }
};

const safeFormatDate = (isoOrAny: string): string => {
  if (!isoOrAny || isoOrAny.trim() === '') {
    return '';
  }
  try {
    const d = new Date(isoOrAny);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    console.log('[NEWS] safeFormatDate fallback for:', isoOrAny);
    return '';
  }
};

const getCachedNews = async (): Promise<{ articles: NewsArticle[] | null; isStale: boolean }> => {
  try {
    const cachedData = await AsyncStorage.getItem(NEWS_CACHE_KEY);
    const cacheTime = await AsyncStorage.getItem(NEWS_CACHE_TIME_KEY);

    if (!cachedData) {
      console.log('[NEWS] No cached data found');
      return { articles: null, isStale: true };
    }

    const parsed = JSON.parse(cachedData) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];
    const articles = list.map((a) => normalizeNewsArticle(a)).filter((a): a is NewsArticle => !!a);

    const lastFetchTime = cacheTime ? parseInt(cacheTime, 10) : 0;
    const now = Date.now();
    const isStale = now - lastFetchTime > CACHE_DURATION;

    console.log(
      '[NEWS] Cache found, stale:',
      isStale,
      'age:',
      Math.round((now - lastFetchTime) / 1000 / 60),
      'minutes',
      'count:',
      articles.length,
    );

    return { articles, isStale };
  } catch (error) {
    console.log('[NEWS] Error reading cache:', error);
    return { articles: null, isStale: true };
  }
};

const setCachedNews = async (articles: NewsArticle[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(articles));
    await AsyncStorage.setItem(NEWS_CACHE_TIME_KEY, Date.now().toString());
    console.log('[NEWS] Cache updated with', articles.length, 'articles');
  } catch (error) {
    console.log('[NEWS] Error saving cache:', error);
  }
};

const fetchWithRetry = async (url: string, options: RequestInit, retries: number = MAX_RETRIES): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[NEWS] Fetch attempt ${attempt}/${retries}`);
      const response = await fetch(url, options);
      return response;
    } catch (error: any) {
      lastError = error;
      console.log(`[NEWS] Attempt ${attempt} failed:`, error?.message);

      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[NEWS] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All fetch attempts failed');
};

const extractDateFromHtml = (htmlSnippet: string, articleIndex: number = 0): string | null => {
  // Try to find <time datetime="...">
  const timeMatch = htmlSnippet.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i);
  if (timeMatch) {
    const d = new Date(timeMatch[1]);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // Try to find date in class="post-date" or class="entry-date" spans
  const dateClassPatterns = [
    /<[^>]*class="[^"]*(?:post-date|entry-date|date|published|meta-date|article-date)[^"]*"[^>]*>([^<]+)</gi,
    /<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)</gi,
    /<div[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)</gi,
  ];

  for (const pattern of dateClassPatterns) {
    const matches = htmlSnippet.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const dateText = match[1].trim();
        const parsed = tryParseDate(dateText);
        if (parsed) return parsed;
      }
    }
  }

  // Try to find date in various formats like "January 25, 2025" or "Jan 25, 2025" or "25 January 2025"
  const datePatterns = [
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi,
    /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})/gi,
    /(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?,?\s+(\d{4})/gi,
    /(\d{4})-(\d{2})-(\d{2})/g, // ISO format YYYY-MM-DD
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // MM/DD/YYYY or DD/MM/YYYY
  ];

  for (const pattern of datePatterns) {
    const matches = [...htmlSnippet.matchAll(pattern)];
    if (matches.length > 0) {
      for (const match of matches) {
        const parsed = tryParseDate(match[0]);
        if (parsed) return parsed;
      }
    }
  }

  return null;
};

const tryParseDate = (dateStr: string): string | null => {
  if (!dateStr || dateStr.length < 6) return null;
  
  try {
    // Clean the string
    const cleaned = dateStr.replace(/(?:st|nd|rd|th)/gi, '').trim();
    const d = new Date(cleaned);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
      return d.toISOString();
    }
  } catch {
    // ignore
  }
  return null;
};

const parseNewsFromHtml = (html: string): NewsArticle[] => {
  const articles: NewsArticle[] = [];
  const seenLinks = new Set<string>();
  const defaultImage = 'https://freedomfm1065.com/wp-content/uploads/2024/01/freedom-fm-logo.png';

  console.log('[NEWS] Starting HTML parsing, length:', html.length);

  const h4Regex = /<h4[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h4>/gi;
  let h4Match;

  while ((h4Match = h4Regex.exec(html)) !== null) {
    try {
      const link = h4Match[1].trim();
      if (seenLinks.has(link)) continue;
      if (link.includes('/category/') || link.includes('/tag/') || link.includes('/author/') || link.includes('/page/')) continue;
      if (link === 'https://freedomfm1065.com/' || link === 'https://freedomfm1065.com/news/') continue;

      const title = decodeHtmlEntities(h4Match[2].replace(/<[^>]*>/g, '').trim());
      if (!title || title.length < 5) continue;

      seenLinks.add(link);

      const linkIndex = h4Match.index;
      const searchArea = html.substring(Math.max(0, linkIndex - 2000), linkIndex + 1000);
      let imageUrl = defaultImage;

      const imgMatch =
        searchArea.match(/<img[^>]*src="([^"]+)"[^>]*>/i) ||
        searchArea.match(/data-src="([^"]+)"/i) ||
        searchArea.match(/background-image[^)]*url\(['"]?([^'"\)]+)['"]?\)/i);

      if (imgMatch && imgMatch[1] && !imgMatch[1].includes('data:') && !imgMatch[1].includes('svg')) {
        imageUrl = imgMatch[1];
      }

      // Try to extract date from surrounding HTML
      const extractedDate = extractDateFromHtml(searchArea, articles.length);
      // If no date found, don't use current date - leave empty to show "No date" or skip showing date
      const articleDate = extractedDate || '';

      articles.push({
        id: stableIdFromLink(link),
        title,
        excerpt: title,
        imageUrl,
        date: articleDate,
        category: 'News',
        link,
        content: '',
      });

      console.log(`[NEWS] Found (h4): ${title.substring(0, 40)}...`);
      if (articles.length >= 30) break;
    } catch (e) {
      console.log('[NEWS] Error parsing h4 article:', e);
    }
  }

  console.log(`[NEWS] Method 1 (h4) found ${articles.length} articles`);

  if (articles.length === 0) {
    console.log('[NEWS] Trying method 2: article tags');
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let articleMatch;

    while ((articleMatch = articleRegex.exec(html)) !== null) {
      try {
        const articleHtml = articleMatch[0];

        const titleMatch =
          articleHtml.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)/i) ||
          articleHtml.match(/<h[1-6][^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

        if (!titleMatch) continue;

        const link = titleMatch[1].trim();
        if (seenLinks.has(link)) continue;
        if (link.includes('/category/') || link.includes('/tag/') || link.includes('/author/')) continue;

        const title = decodeHtmlEntities(titleMatch[2].replace(/<[^>]*>/g, '').trim());
        if (!title || title.length < 5) continue;

        seenLinks.add(link);

        let imageUrl = defaultImage;
        const imgMatch = articleHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
        if (imgMatch && imgMatch[1]) imageUrl = imgMatch[1];

        let dateStr = '';
        const timeMatch = articleHtml.match(/<time[^>]*datetime="([^"]+)"/i);
        if (timeMatch) {
          const d = new Date(timeMatch[1]);
          if (!Number.isNaN(d.getTime())) dateStr = d.toISOString();
        } else {
          const extractedDate = extractDateFromHtml(articleHtml, articles.length);
          if (extractedDate) dateStr = extractedDate;
        }

        articles.push({
          id: stableIdFromLink(link),
          title,
          excerpt: title,
          imageUrl,
          date: dateStr,
          category: 'News',
          link,
          content: '',
        });

        console.log(`[NEWS] Found (article): ${title.substring(0, 40)}...`);
        if (articles.length >= 30) break;
      } catch (e) {
        console.log('[NEWS] Error parsing article:', e);
      }
    }
    console.log(`[NEWS] Method 2 found ${articles.length} articles`);
  }

  if (articles.length === 0) {
    console.log('[NEWS] Trying method 3: generic freedomfm links');

    const linkRegex = /<a[^>]*href="(https?:\/\/(?:www\.)?freedomfm1065\.com\/[^\"]+)"[^>]*>([^<]{10,})<\/a>/gi;
    let linkMatch;

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const link = linkMatch[1].trim();
      const title = decodeHtmlEntities(linkMatch[2].trim());

      if (seenLinks.has(link)) continue;
      if (link.includes('/category/') || link.includes('/tag/') || link.includes('/page/') || link.includes('/author/')) continue;
      if (link === 'https://freedomfm1065.com/' || link === 'https://freedomfm1065.com/news/') continue;
      if (!title || title.length < 10 || title.length > 200) continue;
      if (title.toLowerCase().includes('read more') || title.toLowerCase().includes('click here')) continue;

      seenLinks.add(link);

      // Try to extract date from surrounding area
      const linkIdx = linkMatch.index ?? 0;
      const linkSearchArea = html.substring(Math.max(0, linkIdx - 1000), linkIdx + 500);
      const extractedLinkDate = extractDateFromHtml(linkSearchArea, articles.length);
      const linkArticleDate = extractedLinkDate || '';

      articles.push({
        id: stableIdFromLink(link),
        title,
        excerpt: title,
        imageUrl: defaultImage,
        date: linkArticleDate,
        category: 'News',
        link,
        content: '',
      });

      console.log(`[NEWS] Found (link): ${title.substring(0, 40)}...`);
      if (articles.length >= 30) break;
    }

    console.log(`[NEWS] Method 3 found ${articles.length} articles`);
  }

  return articles;
};

const fetchWithProxy = async (proxyUrl: string, targetUrl: string, signal: AbortSignal): Promise<string | null> => {
  try {
    const fetchUrl = proxyUrl + encodeURIComponent(targetUrl);
    console.log('[NEWS] Trying proxy:', proxyUrl.substring(0, 30));

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
      signal,
    });

    if (!response.ok) {
      console.log('[NEWS] Proxy returned status:', response.status);
      return null;
    }

    const html = await response.text();
    if (html && html.length > 1000) return html;
    return null;
  } catch (e: any) {
    console.log('[NEWS] Proxy failed:', e?.message?.substring(0, 50));
    return null;
  }
};

const fetchFreshNews = async (): Promise<NewsArticle[]> => {
  const controller = new AbortController();
  const timeoutDuration = Platform.OS === 'web' ? 45000 : 25000;

  const timeoutId = setTimeout(() => {
    console.log('[NEWS] Request timeout');
    controller.abort();
  }, timeoutDuration);

  try {
    console.log('[NEWS] Fetching news...', Platform.OS);
    const targetUrl = NEWS_PAGE_URL;
    let html: string | null = null;

    if (Platform.OS === 'web') {
      for (const proxy of CORS_PROXIES) {
        if (controller.signal.aborted) break;
        html = await fetchWithProxy(proxy, targetUrl, controller.signal);
        if (html) {
          console.log('[NEWS] Got HTML via proxy, length:', html.length);
          const test = parseNewsFromHtml(html);
          if (test.length > 0) break;
          console.log('[NEWS] Proxy HTML had 0 articles, trying next proxy');
          html = null;
        }
      }
    } else {
      const headers: Record<string, string> = {
        Accept: 'text/html,application/xhtml+xml,*/*',
        'User-Agent':
          Platform.OS === 'android'
            ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36'
            : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/605.1.15',
        'Cache-Control': 'no-cache',
      };

      try {
        const response = await fetchWithRetry(
          targetUrl,
          {
            method: 'GET',
            headers,
            signal: controller.signal,
          },
          MAX_RETRIES,
        );

        if (response.ok) {
          html = await response.text();
          console.log('[NEWS] Got HTML directly, length:', html?.length);
        }
      } catch (directErr: any) {
        console.log('[NEWS] Direct fetch failed on native:', directErr?.message);
      }

      // If direct fetch failed or produced no parseable articles, fall back to CORS proxies on native too
      let directArticles: NewsArticle[] = [];
      if (html && html.length > 1000) {
        directArticles = parseNewsFromHtml(html);
      }
      if (directArticles.length === 0) {
        console.log('[NEWS] Native direct fetch yielded 0 articles, trying proxies...');
        for (const proxy of CORS_PROXIES) {
          if (controller.signal.aborted) break;
          const proxied = await fetchWithProxy(proxy, targetUrl, controller.signal);
          if (proxied && proxied.length > 1000) {
            const test = parseNewsFromHtml(proxied);
            if (test.length > 0) {
              html = proxied;
              console.log('[NEWS] Native proxy succeeded with', test.length, 'articles');
              break;
            }
          }
        }
      }
    }

    clearTimeout(timeoutId);

    if (!html || html.length < 1000) {
      console.log('[NEWS] No valid HTML received');
      return [];
    }

    const articles = parseNewsFromHtml(html);

    if (articles.length > 0) {
      console.log('[NEWS] Parsed', articles.length, 'articles');
      await setCachedNews(articles);
      return articles;
    }

    console.log('[NEWS] No articles found in HTML');
    return [];
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.log('[NEWS] Fetch error:', error?.message);
    return [];
  }
};

const fetchNewsWithCache = async (): Promise<NewsArticle[]> => {
  try {
    const { articles: cachedArticles, isStale } = await getCachedNews();

    if (cachedArticles && cachedArticles.length > 0 && !isStale) {
      console.log('[NEWS] Returning fresh cached data');
      return cachedArticles;
    }

    console.log('[NEWS] Cache is stale or empty, fetching fresh data...');
    const freshArticles = await fetchFreshNews();

    if (freshArticles.length > 0) {
      return freshArticles;
    }

    if (cachedArticles && cachedArticles.length > 0) {
      console.log('[NEWS] Fresh fetch failed, returning stale cache');
      return cachedArticles;
    }

    console.log('[NEWS] No data available');
    return [];
  } catch (error) {
    console.error('[NEWS] fetchNewsWithCache error:', error);
    return [];
  }
};

function NewsCard({ item, onPress }: { item: NewsArticle; onPress: () => void }) {
  const { data } = useQuery<NewsArticle>({
    queryKey: ['article', item.id],
    queryFn: async () => item,
    enabled: false,
    initialData: item,
  });

  const excerpt = React.useMemo(() => {
    const content = data?.content ?? '';
    return buildExcerptFromContent(content, '');
  }, [data?.content]);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      testID={`news-card-${item.id}`}
      onPress={onPress}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
      </View>
      <View style={styles.cardContent}>
        {item.category?.trim().toLowerCase() !== 'news' && (
          <View style={styles.categoryBadge} testID="news-category-badge">
            <Tag size={12} color={colors.text} style={{ marginRight: 4 }} />
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
        {excerpt.length > 0 && (
          <Text style={styles.excerpt} numberOfLines={2}>
            {excerpt}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const SkeletonCard = () => {
  const fadeAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeAnim]);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
        <View style={styles.skeletonImage} />
      </Animated.View>
      <View style={styles.cardContent}>
        <Animated.View style={[styles.skeletonBadge, { opacity: fadeAnim }]} />
        <Animated.View style={[styles.skeletonTitle, { opacity: fadeAnim }]} />
        <Animated.View style={[styles.skeletonExcerpt, { opacity: fadeAnim, marginTop: 8 }]} />
        <Animated.View style={[styles.skeletonExcerpt, { opacity: fadeAnim, marginTop: 4, width: '60%' }]} />
        <Animated.View style={[styles.skeletonDate, { opacity: fadeAnim, marginTop: 12 }]} />
      </View>
    </View>
  );
};

const INITIAL_VISIBLE_COUNT = 4;
const LOAD_MORE_STEP = 4;

const extractContentBetweenTags = (html: string, startPattern: RegExp): string => {
  const match = html.match(startPattern);
  if (!match) return '';

  const startIndex = (match.index ?? 0) + match[0].length;
  let depth = 1;
  let i = startIndex;
  const tagName = match[0].match(/<(\w+)/)?.[1] || 'div';

  while (i < html.length && depth > 0) {
    const openTag = html.indexOf(`<${tagName}`, i);
    const closeTag = html.indexOf(`</${tagName}`, i);

    if (closeTag === -1) break;

    if (openTag !== -1 && openTag < closeTag) {
      depth += 1;
      i = openTag + 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        return html.substring(startIndex, closeTag);
      }
      i = closeTag + 1;
    }
  }

  return html.substring(startIndex, Math.min(startIndex + 80000, html.length));
};

const extractArticleContentFromHtml = (html: string): string => {
  if (!html) return '';

  const entryContentPattern = /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>/i;
  if (entryContentPattern.test(html)) {
    const content = extractContentBetweenTags(html, entryContentPattern);
    if (content && content.length > 200) return content;
  }

  const articlePattern = /<article[^>]*>/i;
  if (articlePattern.test(html)) {
    const content = extractContentBetweenTags(html, articlePattern);
    if (content && content.length > 200) return content;
  }

  const postContentPattern = /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>/i;
  if (postContentPattern.test(html)) {
    const content = extractContentBetweenTags(html, postContentPattern);
    if (content && content.length > 200) return content;
  }

  const theContentPattern = /<div[^>]*class="[^"]*the-content[^"]*"[^>]*>/i;
  if (theContentPattern.test(html)) {
    const content = extractContentBetweenTags(html, theContentPattern);
    if (content && content.length > 200) return content;
  }

  return '';
};

const fetchArticleContentForPrefetch = async (link: string): Promise<string> => {
  console.log('[NEWS][PREFETCH] Fetching article content from:', link);

  const controller = new AbortController();
  const timeoutDuration = Platform.OS === 'web' ? 30000 : 20000;
  const timeoutId = setTimeout(() => {
    console.log('[NEWS][PREFETCH] Request timeout; aborting');
    controller.abort();
  }, timeoutDuration);

  try {
    const headers: Record<string, string> = {
      Accept: 'text/html,application/xhtml+xml,*/*',
    };

    const tryFetchHtml = async (url: string): Promise<string | null> => {
      try {
        const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
        if (!res.ok) return null;
        const text = await res.text();
        if (!text || text.length < 500) return null;
        return text;
      } catch (e: any) {
        console.log('[NEWS][PREFETCH] fetch failed:', e?.message);
        return null;
      }
    };

    let html: string | null = null;

    if (Platform.OS === 'web') {
      for (const proxy of CORS_PROXIES) {
        if (controller.signal.aborted) break;
        const fetchUrl = proxy + encodeURIComponent(link);
        console.log('[NEWS][PREFETCH] Trying proxy:', proxy.substring(0, 30));
        html = await tryFetchHtml(fetchUrl);
        if (html) break;
      }
    } else {
      headers['User-Agent'] =
        Platform.OS === 'android'
          ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/605.1.15';
      headers['Cache-Control'] = 'no-cache';
      html = await tryFetchHtml(link);
    }

    if (timeoutId) clearTimeout(timeoutId);

    if (!html) {
      console.log('[NEWS][PREFETCH] No HTML received');
      return '';
    }

    const extracted = extractArticleContentFromHtml(html);
    console.log('[NEWS][PREFETCH] Extracted content length:', extracted.length);
    return extracted;
  } finally {
    clearTimeout(timeoutId);
  }
};

const runWithConcurrency = async <T,>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> => {
  const results: T[] = [];
  let idx = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (idx < tasks.length) {
      const current = idx;
      idx += 1;
      try {
        results[current] = await tasks[current]();
      } catch (e) {
        console.log('[NEWS] runWithConcurrency task error:', (e as any)?.message);
      }
    }
  });

  await Promise.allSettled(workers);
  return results;
};

export default function NewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);
  const [showLoadMorePrompt, setShowLoadMorePrompt] = useState<boolean>(false);
  const hasInitialFetched = useRef<boolean>(false);

  const {
    data: articles,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['freedomFmNews'],
    queryFn: fetchNewsWithCache,
    retry: 2,
    staleTime: CACHE_DURATION,
    gcTime: CACHE_DURATION,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    networkMode: 'offlineFirst',
  });

  useEffect(() => {
    if (!hasInitialFetched.current) {
      hasInitialFetched.current = true;
      console.log('[NEWS] Initial mount, triggering fetch...');
      refetch();
    }
  }, [refetch]);

  useEffect(() => {
    try {
      const list = articles ?? [];
      if (list.length === 0) return;

      console.log('[NEWS][PREFETCH] Considering prefetch for first articles:', {
        listCount: list.length,
        visibleCount,
      });

      const firstBatch = list.slice(0, Math.min(visibleCount, list.length));

      const tasks = firstBatch
        .filter((a) => !!a && !!a.link)
        .map((a) => async () => {
          try {
            const key = ['article', a.id] as const;
            const existing = queryClient.getQueryData<NewsArticle>(key);
            if (existing?.content && existing.content.length > 100) {
              console.log('[NEWS][PREFETCH] Already have content for', a.id);
              return;
            }

            console.log('[NEWS][PREFETCH] Prefetching', a.id);
            await queryClient.prefetchQuery({
              queryKey: key,
              queryFn: async () => {
                const content = a.link ? await fetchArticleContentForPrefetch(a.link) : '';
                return {
                  ...a,
                  content,
                } satisfies NewsArticle;
              },
              staleTime: 10 * 60 * 1000,
              gcTime: 30 * 60 * 1000,
            });
          } catch (prefetchErr) {
            console.log('[NEWS][PREFETCH] Single prefetch error:', (prefetchErr as any)?.message);
          }
        });

      runWithConcurrency(tasks, 2).catch((e) => {
        console.log('[NEWS][PREFETCH] Prefetch error:', (e as any)?.message);
      });
    } catch (effectErr) {
      console.log('[NEWS][PREFETCH] Effect error:', (effectErr as any)?.message);
    }
  }, [articles, queryClient, visibleCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setShowLoadMorePrompt(false);

    const freshArticles = await fetchFreshNews();
    if (freshArticles.length > 0) {
      await refetch();
    }

    setRefreshing(false);
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: NewsArticle }) => (
      <NewsCard
        item={item}
        onPress={() => {
          console.log('[NEWS] open article', { id: item.id, title: item.title?.substring(0, 60) });
          router.push({
            pathname: '/(tabs)/(news)/[id]',
            params: {
              id: item.id,
              link: item.link ?? '',
              title: item.title ?? '',
              excerpt: item.excerpt ?? '',
              imageUrl: item.imageUrl ?? '',
              category: item.category ?? '',
            },
          } as any);
        }}
      />
    ),
    [router],
  );

  const allArticles = articles ?? [];
  const hasMore = visibleCount < allArticles.length;
  const visibleArticles = allArticles.slice(0, Math.min(visibleCount, allArticles.length));

  const handleLoadMore = useCallback(() => {
    console.log('[NEWS] Load more pressed', { visibleCount, total: allArticles.length });
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, allArticles.length));
    setShowLoadMorePrompt(false);
  }, [allArticles.length, visibleCount]);

  const renderFooter = useCallback(() => {
    if (!hasMore) return <View style={{ height: 16 }} />;

    if (!showLoadMorePrompt) {
      return <View style={{ height: 24 }} />;
    }

    const remaining = allArticles.length - visibleCount;

    return (
      <View style={styles.loadMoreWrap}>
        <Text style={styles.loadMoreHint} testID="news-load-more-hint">
          You’ve reached the end of the latest {visibleCount} articles.
        </Text>
        <TouchableOpacity
          style={styles.loadMoreButton}
          activeOpacity={0.85}
          onPress={handleLoadMore}
          testID="news-load-more-button"
        >
          <Text style={styles.loadMoreButtonText}>Load {Math.min(LOAD_MORE_STEP, remaining)} more</Text>
        </TouchableOpacity>
      </View>
    );
  }, [allArticles.length, handleLoadMore, hasMore, showLoadMorePrompt, visibleCount]);

  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    console.log('[NEWS] End reached; prompting load more');
    setShowLoadMorePrompt(true);
  }, [hasMore]);

  if ((isLoading || isFetching) && !articles) {
    return (
      <View style={styles.container}>
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <SkeletonCard />}
          keyExtractor={(item) => `skeleton-${item}`}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  if (error || (!isLoading && (!articles || articles.length === 0))) {
    const errorMessage = error instanceof Error ? error.message : 'No news articles available';
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <AlertCircle size={48} color={colors.text} />
          <Text style={styles.errorTitle}>No News Available</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <Text style={[styles.errorMessage, { fontSize: 12, marginTop: 8 }]}>Pull down to refresh and load the latest news</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh} testID="news-refresh-button">
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleArticles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        initialNumToRender={INITIAL_VISIBLE_COUNT}
        windowSize={8}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.25}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  separator: {
    height: 16,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  cardContent: {
    padding: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#333',
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.text,
    lineHeight: 23,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  excerpt: {
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  skeletonImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
  },
  skeletonBadge: {
    width: 80,
    height: 24,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonTitle: {
    width: '90%',
    height: 24,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonExcerpt: {
    width: '100%',
    height: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
  },
  skeletonDate: {
    width: 120,
    height: 14,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
  },
  loadMoreWrap: {
    marginTop: 10,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    alignItems: 'center',
  },
  loadMoreHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  loadMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 220,
    alignItems: 'center',
  },
  loadMoreButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text,
  },
});
