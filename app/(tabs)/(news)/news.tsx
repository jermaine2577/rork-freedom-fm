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

import { Calendar, Tag, AlertCircle } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
const MAX_RETRIES = 2;
const NEWS_CACHE_KEY = 'freedomfm_news_cache_v2';
const NEWS_CACHE_TIME_KEY = 'freedomfm_news_cache_time_v2';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  
  const decodeOnce = (str: string): string => {
    let result = str;
    
    // Handle URL-encoded ampersand first
    result = result.replace(/%26/g, '&');
    result = result.replace(/%23/g, '#');
    
    // Handle quadruple, triple and double-encoded ampersands
    result = result.replace(/&amp;amp;amp;amp;/gi, '&');
    result = result.replace(/&amp;amp;amp;/gi, '&');
    result = result.replace(/&amp;amp;/gi, '&');
    
    // Handle double-encoded entities (e.g., &amp;nbsp; &amp;quot;)
    result = result.replace(/&amp;nbsp;/gi, ' ');
    result = result.replace(/&amp;quot;/gi, '"');
    result = result.replace(/&amp;apos;/gi, "'");
    result = result.replace(/&amp;lt;/gi, '<');
    result = result.replace(/&amp;gt;/gi, '>');
    result = result.replace(/&amp;#(\d+);/gi, '&#$1;');
    result = result.replace(/&amp;#x([a-fA-F0-9]+);/gi, '&#x$1;');
    
    // WordPress specific encodings
    result = result.replace(/&#038;/g, '&');
    result = result.replace(/&#38;/g, '&');
    result = result.replace(/&#0?38;/g, '&');
    
    // Standard HTML entities (case insensitive)
    result = result.replace(/&amp;/gi, '&');
    result = result.replace(/&lt;/gi, '<');
    result = result.replace(/&gt;/gi, '>');
    result = result.replace(/&quot;/gi, '"');
    result = result.replace(/&#0?39;/g, "'");
    result = result.replace(/&#039;/g, "'");
    result = result.replace(/&apos;/gi, "'");
    
    // Smart quotes and typography
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
    
    // Named entities
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
    
    // Handle numeric entities (decimal)
    result = result.replace(/&#(\d+);/g, (_, num) => {
      const code = parseInt(num, 10);
      if (code > 0 && code < 65536) {
        return String.fromCharCode(code);
      }
      return _;
    });
    
    // Handle numeric entities (hex)
    result = result.replace(/&#x([a-fA-F0-9]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      if (code > 0 && code < 65536) {
        return String.fromCharCode(code);
      }
      return _;
    });
    
    // Clean up any remaining artifacts
    result = result.replace(/\u00A0/g, ' '); // Non-breaking space unicode
    
    return result;
  };
  
  // Run multiple passes to catch multi-encoded entities
  let decoded = text;
  let previous = '';
  let iterations = 0;
  const maxIterations = 8;
  
  while (decoded !== previous && iterations < maxIterations) {
    previous = decoded;
    decoded = decodeOnce(decoded);
    iterations++;
  }
  
  return decoded;
};

const getCachedNews = async (): Promise<{ articles: NewsArticle[] | null; isStale: boolean }> => {
  try {
    const cachedData = await AsyncStorage.getItem(NEWS_CACHE_KEY);
    const cacheTime = await AsyncStorage.getItem(NEWS_CACHE_TIME_KEY);
    
    if (!cachedData) {
      console.log('[NEWS] No cached data found');
      return { articles: null, isStale: true };
    }
    
    const articles = JSON.parse(cachedData) as NewsArticle[];
    const lastFetchTime = cacheTime ? parseInt(cacheTime, 10) : 0;
    const now = Date.now();
    const isStale = now - lastFetchTime > CACHE_DURATION;
    
    console.log('[NEWS] Cache found, stale:', isStale, 'age:', Math.round((now - lastFetchTime) / 1000 / 60), 'minutes');
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
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All fetch attempts failed');
};

const parseNewsFromHtml = (html: string): NewsArticle[] => {
  const articles: NewsArticle[] = [];
  const seenLinks = new Set<string>();
  const defaultImage = 'https://freedomfm1065.com/wp-content/uploads/2024/01/freedom-fm-logo.png';
  
  console.log('[NEWS] Starting HTML parsing, length:', html.length);
  
  // Method 1: Parse h4 tags with links (Freedom FM uses h4 for article titles)
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
      
      // Try to find associated image nearby in HTML
      const linkIndex = h4Match.index;
      const searchArea = html.substring(Math.max(0, linkIndex - 2000), linkIndex + 500);
      let imageUrl = defaultImage;
      
      const imgMatch = searchArea.match(/<img[^>]*src="([^"]+)"[^>]*>/i)
        || searchArea.match(/data-src="([^"]+)"/i)
        || searchArea.match(/background-image[^)]*url\(['"]?([^'"\)]+)['"]?\)/i);
      
      if (imgMatch && imgMatch[1] && !imgMatch[1].includes('data:') && !imgMatch[1].includes('svg')) {
        imageUrl = imgMatch[1];
      }
      
      articles.push({
        id: `news-${articles.length}-${Date.now()}`,
        title,
        excerpt: title,
        imageUrl,
        date: new Date().toISOString(),
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
  
  // Method 2: Parse <article> tags
  if (articles.length === 0) {
    console.log('[NEWS] Trying method 2: article tags');
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let articleMatch;
    
    while ((articleMatch = articleRegex.exec(html)) !== null) {
      try {
        const articleHtml = articleMatch[0];
        
        const titleMatch = articleHtml.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)/i)
          || articleHtml.match(/<h[1-6][^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        
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
        
        let dateStr = new Date().toISOString();
        const timeMatch = articleHtml.match(/<time[^>]*datetime="([^"]+)"/i);
        if (timeMatch) {
          const d = new Date(timeMatch[1]);
          if (!isNaN(d.getTime())) dateStr = d.toISOString();
        }
        
        articles.push({
          id: `news-${articles.length}-${Date.now()}`,
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
  
  // Method 3: Find all freedomfm article links
  if (articles.length === 0) {
    console.log('[NEWS] Trying method 3: generic freedomfm links');
    
    const linkRegex = /<a[^>]*href="(https?:\/\/(?:www\.)?freedomfm1065\.com\/[^"]+)"[^>]*>([^<]{10,})<\/a>/gi;
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
      
      articles.push({
        id: `news-${articles.length}-${Date.now()}`,
        title,
        excerpt: title,
        imageUrl: defaultImage,
        date: new Date().toISOString(),
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
      headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
      signal,
    });
    
    if (!response.ok) {
      console.log('[NEWS] Proxy returned status:', response.status);
      return null;
    }
    
    const html = await response.text();
    if (html && html.length > 1000) {
      return html;
    }
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
          break;
        }
      }
    } else {
      const headers: Record<string, string> = {
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'User-Agent': Platform.OS === 'android' 
          ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/605.1.15',
        'Cache-Control': 'no-cache',
      };
      
      const response = await fetchWithRetry(targetUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      }, MAX_RETRIES);
      
      if (response.ok) {
        html = await response.text();
        console.log('[NEWS] Got HTML directly, length:', html?.length);
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
};

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
      ])
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

const extractArticleContentFromHtml = (html: string): string => {
  const entryContentMatch = html.match(
    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<footer|<aside|<nav|<section|$)/i,
  );
  if (entryContentMatch) return entryContentMatch[1];

  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];

  const postContentMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (postContentMatch) return postContentMatch[1];

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

const runWithConcurrency = async <T,>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> => {
  const results: T[] = [];
  let idx = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (idx < tasks.length) {
      const current = idx;
      idx += 1;
      try {
        results[current] = await tasks[current]();
      } catch (e) {
        throw e;
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
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);
  const [showLoadMorePrompt, setShowLoadMorePrompt] = useState<boolean>(false);
  const hasInitialFetched = useRef(false);
  
  const { data: articles, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['freedomFmNews'],
    queryFn: fetchNewsWithCache,
    retry: 3,
    staleTime: CACHE_DURATION,
    gcTime: CACHE_DURATION,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchInterval: false,
    networkMode: 'always',
  });

  useEffect(() => {
    if (!hasInitialFetched.current) {
      hasInitialFetched.current = true;
      console.log('[NEWS] Initial mount, triggering fetch...');
      refetch();
    }
  }, [refetch]);

  useEffect(() => {
    const list = articles ?? [];
    if (list.length === 0) return;

    console.log('[NEWS][PREFETCH] Considering prefetch for first articles:', {
      listCount: list.length,
      visibleCount,
    });

    const firstBatch = list.slice(0, Math.min(INITIAL_VISIBLE_COUNT, list.length));

    const tasks = firstBatch
      .filter((a) => !!a.link)
      .map((a) => async () => {
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
      });

    runWithConcurrency(tasks, 2).catch((e) => {
      console.log('[NEWS][PREFETCH] Prefetch error:', (e as any)?.message);
    });
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
  
  const renderItem = useCallback(({ item }: { item: NewsArticle }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.8}
      testID={`news-card-${item.id}`}
      onPress={() => router.push(`/(tabs)/(news)/${item.id}` as any)}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.image}
          resizeMode="cover"
        />
      </View>
      <View style={styles.cardContent}>
        {item.category?.trim().toLowerCase() !== 'news' && (
          <View style={styles.categoryBadge} testID="news-category-badge">
            <Tag size={12} color={colors.text} />
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.excerpt} numberOfLines={2}>
          {item.excerpt}
        </Text>
        <View style={styles.dateContainer}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={styles.date}>
            {new Date(item.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [router]);

  if ((isLoading || isFetching) && !articles) {
    return (
      <View style={styles.container}>
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <SkeletonCard />}
          keyExtractor={(item) => `skeleton-${item}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 16 }
          ]}
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
          <Text style={styles.errorMessage}>
            {errorMessage}
          </Text>
          <Text style={[styles.errorMessage, { fontSize: 12, marginTop: 8 }]}>Pull down to refresh and load the latest news</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          <Text style={styles.loadMoreButtonText}>
            Load {Math.min(LOAD_MORE_STEP, remaining)} more
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [allArticles.length, handleLoadMore, hasMore, showLoadMorePrompt, visibleCount]);

  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    console.log('[NEWS] End reached; prompting load more');
    setShowLoadMorePrompt(true);
  }, [hasMore]);

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleArticles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 16 }
        ]}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
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
    gap: 16,
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
    gap: 4,
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
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 8,
  },
  excerpt: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  loadingText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
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
});
