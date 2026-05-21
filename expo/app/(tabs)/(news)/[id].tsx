import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
  Share,
  Platform,
  Alert,
  Animated,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Tag, AlertCircle, Share2, ChevronLeft } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import colors from '@/constants/colors';
import { NewsArticle } from '@/types';

const { width } = Dimensions.get('window');

const SkeletonArticle = () => {
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
    <>
      <Animated.View style={[styles.heroImage, styles.skeletonHeroImage, { opacity: fadeAnim }]} />
      
      <View style={styles.content}>
        <Animated.View style={[styles.skeletonBadge, { opacity: fadeAnim }]} />
        <Animated.View style={[styles.skeletonTitle, { opacity: fadeAnim }]} />
        <Animated.View style={[styles.skeletonTitle, { opacity: fadeAnim, width: '60%', marginTop: 8 }]} />
        <Animated.View style={[styles.skeletonDate, { opacity: fadeAnim, marginTop: 16 }]} />
        
        <View style={styles.divider} />
        
        <Animated.View style={[styles.skeletonBody, { opacity: fadeAnim }]} />
        <Animated.View style={[styles.skeletonBody, { opacity: fadeAnim, marginTop: 8 }]} />
        <Animated.View style={[styles.skeletonBody, { opacity: fadeAnim, marginTop: 8, width: '90%' }]} />
        <Animated.View style={[styles.skeletonBody, { opacity: fadeAnim, marginTop: 16 }]} />
        <Animated.View style={[styles.skeletonBody, { opacity: fadeAnim, marginTop: 8 }]} />
        <Animated.View style={[styles.skeletonBody, { opacity: fadeAnim, marginTop: 8, width: '70%' }]} />
      </View>
    </>
  );
};


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

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://proxy.cors.sh/',
] as const;

const extractContentBetweenTags = (html: string, startPattern: RegExp): string => {
  const match = html.match(startPattern);
  if (!match) return '';
  
  const startIndex = match.index! + match[0].length;
  let depth = 1;
  let i = startIndex;
  const tagName = match[0].match(/<(\w+)/)?.[1] || 'div';
  
  while (i < html.length && depth > 0) {
    const openTag = html.indexOf(`<${tagName}`, i);
    const closeTag = html.indexOf(`</${tagName}`, i);
    
    if (closeTag === -1) break;
    
    if (openTag !== -1 && openTag < closeTag) {
      depth++;
      i = openTag + 1;
    } else {
      depth--;
      if (depth === 0) {
        return html.substring(startIndex, closeTag);
      }
      i = closeTag + 1;
    }
  }
  
  return html.substring(startIndex, Math.min(startIndex + 50000, html.length));
};

const fetchViaWordPressApi = async (link: string, signal: AbortSignal): Promise<string> => {
  // FreedomFM runs WordPress; the REST API is far more reliable than HTML scraping.
  // Extract a slug from the URL (last non-empty path segment) and query /wp-json/wp/v2/posts?slug=...
  try {
    const url = new URL(link);
    const segments = url.pathname.split('/').filter((s) => s.length > 0);
    const slug = segments[segments.length - 1];
    if (!slug) {
      console.log('[ARTICLE] WP API: no slug found in URL');
      return '';
    }
    const apiUrl = `${url.origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=content,excerpt,title`;
    console.log('[ARTICLE] Trying WP REST API:', apiUrl.substring(0, 120));
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) {
      console.log('[ARTICLE] WP API non-ok:', res.status);
      return '';
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log('[ARTICLE] WP API empty array');
      return '';
    }
    const rendered = data[0]?.content?.rendered as string | undefined;
    if (!rendered || rendered.length < 100) {
      console.log('[ARTICLE] WP API content too short:', rendered?.length);
      return '';
    }
    console.log('[ARTICLE] WP API succeeded, length:', rendered.length);
    return rendered;
  } catch (e: any) {
    console.log('[ARTICLE] WP API failed:', e?.message);
    return '';
  }
};

const fetchViaJinaReader = async (link: string, signal: AbortSignal): Promise<string> => {
  // Jina Reader returns clean markdown of any URL with permissive CORS.
  // Works on both web and native, no API key needed for low volume.
  const url = `https://r.jina.ai/${link}`;
  console.log('[ARTICLE] Trying Jina Reader:', url.substring(0, 80));
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/plain, text/markdown, */*' },
      signal,
    });
    if (!res.ok) {
      console.log('[ARTICLE] Jina Reader non-ok:', res.status);
      return '';
    }
    const text = await res.text();
    if (!text || text.length < 200) {
      console.log('[ARTICLE] Jina Reader returned too little, length:', text?.length);
      return '';
    }
    // Strip Jina's metadata header (Title:, URL Source:, Markdown Content:)
    let body = text;
    const marker = /Markdown Content:\s*/i;
    const m = body.match(marker);
    if (m && m.index !== undefined) {
      body = body.substring(m.index + m[0].length);
    }
    // Convert markdown to plain-text-ish HTML so cleanHtmlContent works.
    // Drop image lines, link wrappers -> just text.
    body = body
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> text
      .replace(/^#{1,6}\s+/gm, '') // headings
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
      .replace(/\*([^*]+)\*/g, '$1') // italic
      .replace(/`([^`]+)`/g, '$1'); // code
    // Wrap paragraphs in <p> so the existing cleaner produces nice line breaks.
    const paragraphs = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => `<p>${p}</p>`)
      .join('\n');
    console.log('[ARTICLE] Jina Reader succeeded, length:', paragraphs.length);
    return paragraphs;
  } catch (e: any) {
    console.log('[ARTICLE] Jina Reader failed:', e?.message);
    return '';
  }
};

const fetchArticleContent = async (link: string): Promise<string> => {
  console.log('[ARTICLE] Fetching full content from:', link);
  
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  
  try {
    const timeoutDuration = Platform.OS === 'web' ? 30000 : 25000;
    timeoutId = setTimeout(() => {
      console.log('[ARTICLE] Request timeout, aborting...');
      controller.abort();
    }, timeoutDuration);

    // Try WordPress REST API first — most reliable for WP sites like freedomfm1065.com.
    const wpContent = await fetchViaWordPressApi(link, controller.signal);
    if (wpContent && wpContent.length > 200) {
      if (timeoutId) clearTimeout(timeoutId);
      return wpContent;
    }

    // Try Jina Reader next — it bypasses CORS and HTML structure issues entirely.
    const jinaContent = await fetchViaJinaReader(link, controller.signal);
    if (jinaContent && jinaContent.length > 200) {
      if (timeoutId) clearTimeout(timeoutId);
      return jinaContent;
    }
    
    const headers: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
    
    let fetchUrl: string;
    if (Platform.OS === 'web') {
      fetchUrl = CORS_PROXIES[0] + encodeURIComponent(link);
    } else {
      fetchUrl = link;
      headers['User-Agent'] = Platform.OS === 'android' 
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      headers['Cache-Control'] = 'no-cache';
    }
    
    const tryFetch = async (url: string): Promise<Response | null> => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        if (!res.ok) return null;
        return res;
      } catch (e: any) {
        console.log('[ARTICLE] fetch failed:', e?.message);
        return null;
      }
    };

    let response: Response | null = null;

    if (Platform.OS === 'web') {
      for (const proxy of CORS_PROXIES) {
        if (controller.signal.aborted) break;
        const attemptUrl = proxy + encodeURIComponent(link);
        console.log('[ARTICLE] Trying proxy:', proxy.substring(0, 30));
        response = await tryFetch(attemptUrl);
        if (response) break;
      }
    } else {
      // Try direct first on native
      response = await tryFetch(fetchUrl);
      // Validate the direct response actually contains article markup; if not, fall through to proxies
      if (response) {
        try {
          const cloned = response.clone();
          const peek = await cloned.text();
          const hasArticleMarkup =
            /entry-content|<article[\s>]|post-content|the-content|content-area/i.test(peek);
          if (!hasArticleMarkup || peek.length < 500) {
            console.log('[ARTICLE] Native direct fetch missing article markup, will try proxies. length=', peek.length);
            response = null;
          }
        } catch (e) {
          console.log('[ARTICLE] peek failed', (e as any)?.message);
        }
      }
      // Proxy fallback on native
      if (!response) {
        const nativeHeaders: Record<string, string> = {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };
        for (const proxy of CORS_PROXIES) {
          if (controller.signal.aborted) break;
          const attemptUrl = proxy + encodeURIComponent(link);
          console.log('[ARTICLE] Native trying proxy:', proxy.substring(0, 30));
          try {
            const res = await fetch(attemptUrl, {
              method: 'GET',
              headers: nativeHeaders,
              signal: controller.signal,
            });
            if (res.ok) {
              response = res;
              console.log('[ARTICLE] Native proxy succeeded');
              break;
            }
          } catch (e: any) {
            console.log('[ARTICLE] Native proxy failed:', e?.message);
          }
        }
      }
    }

    if (!response) {
      console.log('[ARTICLE] Failed to fetch HTML via all methods');
      throw new Error('Could not load the full article. Please try again.');
    }
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    
    if (!response.ok) {
      console.log('[ARTICLE] Server error:', response.status);
      throw new Error(`Server error: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('[ARTICLE] Received HTML, length:', html.length);
    
    let content = '';
    
    // Try entry-content with proper nested div handling
    const entryContentPattern = /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>/i;
    if (entryContentPattern.test(html)) {
      content = extractContentBetweenTags(html, entryContentPattern);
      console.log('[ARTICLE] Found entry-content, length:', content.length);
    }
    
    // Fallback: try article tag with proper nesting
    if (!content || content.length < 200) {
      const articlePattern = /<article[^>]*>/i;
      if (articlePattern.test(html)) {
        const articleContent = extractContentBetweenTags(html, articlePattern);
        if (articleContent.length > content.length) {
          content = articleContent;
          console.log('[ARTICLE] Found article tag, length:', content.length);
        }
      }
    }
    
    // Fallback: try post-content
    if (!content || content.length < 200) {
      const postContentPattern = /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>/i;
      if (postContentPattern.test(html)) {
        const postContent = extractContentBetweenTags(html, postContentPattern);
        if (postContent.length > content.length) {
          content = postContent;
          console.log('[ARTICLE] Found post-content, length:', content.length);
        }
      }
    }
    
    // Fallback: try the-content
    if (!content || content.length < 200) {
      const theContentPattern = /<div[^>]*class="[^"]*the-content[^"]*"[^>]*>/i;
      if (theContentPattern.test(html)) {
        const theContent = extractContentBetweenTags(html, theContentPattern);
        if (theContent.length > content.length) {
          content = theContent;
          console.log('[ARTICLE] Found the-content, length:', content.length);
        }
      }
    }
    
    // Fallback: try content-area
    if (!content || content.length < 200) {
      const contentAreaPattern = /<div[^>]*class="[^"]*content-area[^"]*"[^>]*>/i;
      if (contentAreaPattern.test(html)) {
        const areaContent = extractContentBetweenTags(html, contentAreaPattern);
        if (areaContent.length > content.length) {
          content = areaContent;
          console.log('[ARTICLE] Found content-area, length:', content.length);
        }
      }
    }
    
    console.log('[ARTICLE] Final content length:', content.length);
    return content;
    
  } catch (error: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    console.log('[ARTICLE] Error fetching content:', error?.message);
    throw error;
  }
};

const fetchArticle = async (id: string, cachedArticle?: NewsArticle): Promise<NewsArticle> => {
  console.log('[ARTICLE] fetchArticle called with id:', id);
  console.log('[ARTICLE] Has cached article:', !!cachedArticle);

  if (!cachedArticle) {
    console.log('[ARTICLE] No cached article found for id:', id);
    throw new Error('Article not found. Please go back and try again.');
  }

  console.log('[ARTICLE] Using cached article:', cachedArticle.title?.substring(0, 50));

  if (cachedArticle.content && cachedArticle.content.length > 1000) {
    console.log('[ARTICLE] Cached article has full content, returning');
    return cachedArticle;
  }

  if (cachedArticle.link) {
    console.log('[ARTICLE] Fetching full content from:', cachedArticle.link);
    try {
      const fullContent = await fetchArticleContent(cachedArticle.link);
      if (fullContent && fullContent.length > 200) {
        console.log('[ARTICLE] Got full content, length:', fullContent.length);
        return {
          ...cachedArticle,
          content: fullContent,
        };
      }

      console.log('[ARTICLE] Full content too short or empty, using fallback');
    } catch (error: any) {
      console.log('[ARTICLE] Failed to fetch full content:', error?.message);
    }
  } else {
    console.log('[ARTICLE] No link available; cannot fetch full content');
  }

  return cachedArticle;
};

const safeFormatLongDate = (isoOrAny: string): string => {
  try {
    const d = new Date(isoOrAny);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    console.log('[ARTICLE] safeFormatLongDate fallback for:', isoOrAny);
    return '';
  }
};

const cleanHtmlContent = (html: string): string => {
  if (!html) return '';
  
  let cleaned = html
    .replace(/<p>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<h[1-6]>/g, '\n')
    .replace(/<\/h[1-6]>/g, '\n\n')
    .replace(/<li>/g, '\n• ')
    .replace(/<\/li>/g, '')
    .replace(/<[^>]*>/g, '');
  
  // Apply HTML entity decoding
  cleaned = decodeHtmlEntities(cleaned);
  
  // Clean up extra whitespace
  cleaned = cleaned
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  
  return cleaned;
};

export default function ArticleDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    link?: string;
    title?: string;
    excerpt?: string;
    imageUrl?: string;
    date?: string;
    category?: string;
  }>();
  const id = params?.id;
  const insets = useSafeAreaInsets();
  const androidStatusBar = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;
  // Ensure the header clears the device status bar even when safe-area insets
  // are 0 (e.g. inside the Rork web preview, where useSafeAreaInsets returns 0).
  const topInset = Math.max(insets.top, androidStatusBar, 44);
  const headerPadTop = topInset + 12;
  const router = useRouter();
  const queryClient = useQueryClient();


  // Get the article from the news list cache
  const getCachedArticle = (): NewsArticle | undefined => {
    const newsData = queryClient.getQueryData<NewsArticle[]>(['freedomFmNews']);
    if (newsData && id) {
      const found = newsData.find((article) => article.id === id);
      console.log('[ARTICLE] Looking for cached article with id:', id, 'found:', !!found);
      return found;
    }
    return undefined;
  };

  const paramArticle = React.useMemo<NewsArticle | undefined>(() => {
    if (!id) return undefined;

    const link = (params?.link ?? '').trim();
    const title = (params?.title ?? '').trim();

    if (!title) return undefined;

    const fallback: NewsArticle = {
      id,
      title,
      excerpt: (params?.excerpt ?? title).toString(),
      imageUrl:
        (params?.imageUrl ?? '').trim() || 'https://freedomfm1065.com/wp-content/uploads/2024/01/freedom-fm-logo.png',
      date: (params?.date ?? new Date().toISOString()).toString(),
      category: (params?.category ?? 'News').toString(),
      link: link.length > 0 ? link : undefined,
      content: '',
    };

    console.log('[ARTICLE] Built paramArticle fallback', { id, hasLink: !!fallback.link, titleLen: title.length });
    return fallback;
  }, [id, params?.category, params?.date, params?.excerpt, params?.imageUrl, params?.link, params?.title]);

  const cachedArticle = getCachedArticle();
  const initialArticle = cachedArticle ?? paramArticle;

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id as string, initialArticle),
    enabled: !!id && !!initialArticle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const displayArticle = article || initialArticle;

  const handleShare = useCallback(async () => {
    if (!displayArticle) {
      console.log('[NEWS][SHARE] No article to share');
      Alert.alert('Nothing to share', 'Please wait for the article to load and try again.');
      return;
    }

    const title = (displayArticle.title ?? '').trim() || 'Freedom FM News';
    const excerptRaw = (displayArticle.excerpt ?? '').trim();
    const excerpt = excerptRaw.length > 220 ? `${excerptRaw.slice(0, 217)}...` : excerptRaw;

    const shareUrlRaw = displayArticle.link ?? '';
    const shareUrl = typeof shareUrlRaw === 'string' ? shareUrlRaw.trim() : '';
    const hasUrl = shareUrl.length > 0;

    const baseText = excerpt.length > 0 ? `${title}\n\n${excerpt}` : title;
    const shareMessage = hasUrl ? `${title}\n\n${shareUrl}` : baseText;

    console.log('[NEWS][SHARE] pressed', {
      platform: Platform.OS,
      id: displayArticle.id,
      hasUrl,
      shareUrl: hasUrl ? shareUrl : undefined,
      titleLen: title.length,
      excerptLen: excerpt.length,
    });

    try {
      if (Platform.OS === 'web') {
        const nav = (globalThis as any)?.navigator as any;
        if (nav?.share) {
          console.log('[NEWS][SHARE] Using Web Share API');
          const payload: { title?: string; text?: string; url?: string } = {
            title,
            text: baseText,
          };
          if (hasUrl) payload.url = shareUrl;
          await nav.share(payload);
          return;
        }

        console.log('[NEWS][SHARE] Web Share API unavailable; falling back');
        const copyText = hasUrl ? shareUrl : shareMessage;
        await Clipboard.setStringAsync(copyText);
        Alert.alert('Copied', hasUrl ? 'Article link copied to clipboard.' : 'Share text copied to clipboard.');
        return;
      }

      console.log('[NEWS][SHARE] Opening native share sheet');

      const result = await Share.share(
        Platform.OS === 'ios'
          ? {
              title,
              message: baseText,
              ...(hasUrl ? { url: shareUrl } : {}),
            }
          : {
              title,
              message: shareMessage,
            },
        Platform.OS === 'android'
          ? {
              dialogTitle: 'Share article',
            }
          : undefined
      );

      console.log('[NEWS][SHARE] result', result);
    } catch (e) {
      const msg = (e as any)?.message as string | undefined;
      console.error('[NEWS][SHARE] error', msg ?? e);

      try {
        const copyText = hasUrl ? shareUrl : shareMessage;
        console.log('[NEWS][SHARE] Falling back to clipboard copy');
        await Clipboard.setStringAsync(copyText);
        Alert.alert('Copied', 'Sharing failed, so we copied the share text to your clipboard.');
        return;
      } catch (copyErr) {
        console.error('[NEWS][SHARE] clipboard fallback failed', (copyErr as any)?.message ?? copyErr);
      }

      Alert.alert('Error', 'Could not share this article. Please try again.');
    }
  }, [displayArticle]);

  const handleBack = useCallback(() => {
    console.log('[NEWS][BACK] pressed');
    try {
      router.back();
    } catch (e) {
      console.log('[NEWS][BACK] fallback replace', e);
      router.replace('/(tabs)/(news)/news');
    }
  }, [router]);

  if (isLoading && !cachedArticle) {
    return (
      <View style={styles.container}>
        <View style={[styles.topHeader, { paddingTop: headerPadTop }]} testID="news-article-top-header-loading">
          <TouchableOpacity
            testID="news-article-back"
            style={styles.topHeaderIconBtn}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>
          <Text testID="news-article-top-title" style={styles.topHeaderTitle} numberOfLines={1}>
            Loading…
          </Text>
          <View style={styles.topHeaderSide} />
        </View>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <SkeletonArticle />
        </ScrollView>
      </View>
    );
  }

  if (!displayArticle) {
    const errorMessage = error instanceof Error ? error.message : 'Article not found';
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.topHeader, { paddingTop: headerPadTop }]} testID="news-article-top-header-error">
          <TouchableOpacity
            testID="news-article-back"
            style={styles.topHeaderIconBtn}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>
          <Text testID="news-article-top-title" style={styles.topHeaderTitle} numberOfLines={1}>
            News
          </Text>
          <View style={styles.topHeaderSide} />
        </View>
        <AlertCircle size={48} color={colors.text} />
        <Text style={styles.errorTitle}>Failed to load article</Text>
        <Text style={styles.errorMessage}>{errorMessage}</Text>
        <Text style={[styles.errorMessage, { fontSize: 12, marginTop: 8 }]}>Please go back and try again</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleBack} testID="news-article-go-back">
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topHeader, { paddingTop: headerPadTop }]} testID="news-article-top-header">
        <TouchableOpacity
          testID="news-article-back"
          style={styles.topHeaderIconBtn}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text testID="news-article-top-title" style={styles.topHeaderTitle} numberOfLines={1}>
          {displayArticle.title}
        </Text>
        <TouchableOpacity
          onPress={handleShare}
          style={[styles.topHeaderIconBtn, { alignItems: 'flex-end' }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="news-article-share"
        >
          <Share2 size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.loadingBanner}>
          <Text style={styles.loadingBannerText}>Loading full article...</Text>
        </View>
      )}
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
      <Image source={{ uri: displayArticle.imageUrl }} style={styles.heroImage} />
      
      <View style={styles.content}>
        {displayArticle.category?.trim().toLowerCase() !== 'news' && (
          <View style={styles.categoryBadge} testID="news-article-category-badge">
            <Tag size={14} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.categoryText}>{displayArticle.category}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.body}>
          {(article?.content || displayArticle.content) 
            ? cleanHtmlContent(article?.content || displayArticle.content || '') 
            : displayArticle.excerpt}
        </Text>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  heroImage: {
    width: width,
    height: width * 0.6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#1a1a1a',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.red,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.text,
    lineHeight: 36,
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  date: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 24,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
    marginBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#121212',
  },
  loadingText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
  },
  loadingBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  loadingBannerText: {
    fontSize: 12,
    color: colors.textSecondary,
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    paddingHorizontal: 16,
    paddingBottom: 18,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  topHeaderIconBtn: {
    width: 40,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topHeaderSide: {
    width: 40,
    height: 36,
  },
  topHeaderTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  shareButton: {
    padding: 8,
    marginRight: 8,
  },
  webHeader: {
    backgroundColor: '#121212',
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 100,
    elevation: 10,
  },
  webHeaderIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webHeaderIconText: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700' as const,
    marginTop: -2,
  },
  webHeaderTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    marginHorizontal: 10,
  },
  skeletonHeroImage: {
    backgroundColor: '#2a2a2a',
  },
  skeletonBadge: {
    width: 90,
    height: 28,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    marginBottom: 16,
  },
  skeletonTitle: {
    width: '100%',
    height: 32,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
  },
  skeletonDate: {
    width: 140,
    height: 18,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    marginBottom: 20,
  },
  skeletonBody: {
    width: '100%',
    height: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
  },
});
