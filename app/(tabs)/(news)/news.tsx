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

import { Calendar, Tag, AlertCircle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { NewsArticle } from '@/types';

const NEWS_PAGE_URL = 'https://freedomfm1065.com/news/';
const MAX_RETRIES = 3;

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

const getMockData = async (): Promise<NewsArticle[]> => {
  const { newsArticles } = await import('@/mocks/news');
  return newsArticles;
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
  
  // Pattern to match article blocks - looking for common WordPress article patterns
  // Match article containers with titles and links
  const articlePatterns = [
    // Pattern 1: <article> tags with title links
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    // Pattern 2: Post containers with entry-title
    /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*post|$)/gi,
  ];
  
  // Try to find articles using <article> tags first
  const articleMatches = html.match(/<article[^>]*>[\s\S]*?<\/article>/gi) || [];
  
  console.log(`[NEWS] Found ${articleMatches.length} article tags`);
  
  articleMatches.forEach((articleHtml, index) => {
    try {
      // Extract title and link
      const titleMatch = articleHtml.match(/<h[1-4][^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i)
        || articleHtml.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/a>/i)
        || articleHtml.match(/<h[1-4][^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
      
      if (!titleMatch) {
        console.log(`[NEWS] No title found in article ${index}`);
        return;
      }
      
      const link = titleMatch[1];
      const title = decodeHtmlEntities(titleMatch[2].trim());
      
      // Extract image
      const imageMatch = articleHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i)
        || articleHtml.match(/data-src="([^"]+)"/i)
        || articleHtml.match(/srcset="([^\s"]+)/i);
      const imageUrl = imageMatch ? imageMatch[1] : 'https://freedomfm1065.com/wp-content/uploads/2024/01/freedom-fm-logo.png';
      
      // Extract date
      const dateMatch = articleHtml.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i)
        || articleHtml.match(/<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>/i)
        || articleHtml.match(/([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/i)
        || articleHtml.match(/(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i)
        || articleHtml.match(/January|February|March|April|May|June|July|August|September|October|November|December\s+\d{1,2}/i);
      
      let dateStr = new Date().toISOString();
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[1]);
        if (!isNaN(parsedDate.getTime())) {
          dateStr = parsedDate.toISOString();
        }
      }
      
      // Extract excerpt
      const excerptMatch = articleHtml.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        || articleHtml.match(/<p[^>]*class="[^"]*excerpt[^"]*"[^>]*>([^<]+)<\/p>/i)
        || articleHtml.match(/<div[^>]*class="[^"]*excerpt[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        || articleHtml.match(/<p>([^<]{20,})<\/p>/i);
      
      let excerpt = '';
      if (excerptMatch) {
        excerpt = decodeHtmlEntities(excerptMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 200));
      }
      
      // Generate unique ID from link
      const id = link.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50) + '-' + index;
      
      articles.push({
        id,
        title,
        excerpt: excerpt || title,
        imageUrl,
        date: dateStr,
        category: 'News',
        link,
        content: '',
      });
      
      console.log(`[NEWS] Parsed article: ${title.substring(0, 50)}...`);
    } catch (e) {
      console.log(`[NEWS] Error parsing article ${index}:`, e);
    }
  });
  
  // If no articles found with <article> tags, try alternative patterns
  if (articles.length === 0) {
    console.log('[NEWS] Trying alternative parsing patterns...');
    
    // Look for links that look like news article URLs
    const linkPattern = /<a[^>]*href="(https:\/\/freedomfm1065\.com\/[a-z0-9-]+\/)"[^>]*>\s*(?:<[^>]+>)*([^<]+)/gi;
    let match;
    const seenLinks = new Set<string>();
    
    while ((match = linkPattern.exec(html)) !== null) {
      const link = match[1];
      const title = decodeHtmlEntities(match[2].trim());
      
      // Skip if not a news article link or already seen
      if (seenLinks.has(link) || 
          link.includes('/category/') || 
          link.includes('/tag/') ||
          link.includes('/author/') ||
          link.includes('/page/') ||
          link === 'https://freedomfm1065.com/' ||
          link === 'https://freedomfm1065.com/news/' ||
          title.length < 10) {
        continue;
      }
      
      seenLinks.add(link);
      
      // Try to find associated image
      const contextStart = Math.max(0, match.index - 500);
      const contextEnd = Math.min(html.length, match.index + 500);
      const context = html.substring(contextStart, contextEnd);
      
      const imgMatch = context.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
      const imageUrl = imgMatch ? imgMatch[1] : 'https://freedomfm1065.com/wp-content/uploads/2024/01/freedom-fm-logo.png';
      
      articles.push({
        id: `article-${articles.length}`,
        title,
        excerpt: title,
        imageUrl,
        date: new Date().toISOString(),
        category: 'News',
        link,
        content: '',
      });
      
      if (articles.length >= 20) break;
    }
  }
  
  return articles;
};

const fetchNewsFromHtmlPage = async (): Promise<NewsArticle[]> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  
  try {
    const timeoutDuration = Platform.OS === 'web' ? 20000 : Platform.OS === 'android' ? 15000 : 12000;
    timeoutId = setTimeout(() => {
      console.log('[NEWS] Request timeout, aborting...');
      controller.abort();
    }, timeoutDuration);
    
    console.log('[NEWS] Fetching news page HTML...', Platform.OS);
    
    const cacheBuster = `?_t=${Date.now()}`;
    const headers: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
    
    if (Platform.OS !== 'web') {
      headers['User-Agent'] = Platform.OS === 'android' 
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      headers['Cache-Control'] = 'no-cache';
    }
    
    const response = await fetchWithRetry(NEWS_PAGE_URL + cacheBuster, {
      method: 'GET',
      headers,
      signal: controller.signal,
    }, MAX_RETRIES);
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    
    if (!response.ok) {
      console.log('[NEWS] Server returned error status:', response.status);
      throw new Error(`Server error: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('[NEWS] Received HTML, length:', html.length);
    
    const articles = parseNewsFromHtml(html);
    
    if (articles.length === 0) {
      console.log('[NEWS] No articles parsed from HTML, using mock data');
      return getMockData();
    }
    
    console.log('[NEWS] Successfully parsed', articles.length, 'articles from HTML');
    return articles;
    
  } catch (error: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    const errorMsg = error?.message || 'Unknown error';
    console.log('[NEWS] Error fetching news page:', errorMsg);
    
    if (error?.name === 'AbortError') {
      console.log('[NEWS] Request was aborted (timeout)');
    }
    
    console.log('[NEWS] Falling back to mock data');
    return getMockData();
  }
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

export default function NewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const hasInitialFetched = useRef(false);
  
  const { data: articles, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['freedomFmNews'],
    queryFn: fetchNewsFromHtmlPage,
    retry: 2,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    networkMode: 'always',
  });

  // Force refetch on Android after initial mount to ensure fresh data
  useEffect(() => {
    if (Platform.OS === 'android' && !hasInitialFetched.current) {
      hasInitialFetched.current = true;
      // Small delay to let the component mount, then force a fresh fetch
      const timer = setTimeout(() => {
        console.log('[NEWS] Android: Forcing initial refetch for fresh data');
        refetch();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [refetch]);

  // Additional refetch when screen comes into focus for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const focusTimer = setTimeout(() => {
        if (articles && articles.length === 0) {
          console.log('[NEWS] Android: No articles, forcing refetch');
          refetch();
        }
      }, 500);
      return () => clearTimeout(focusTimer);
    }
  }, [articles, refetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  
  const renderItem = useCallback(({ item }: { item: NewsArticle }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.8}
      onPress={() => router.push(`/(tabs)/(news)/${item.id}` as any)}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.image}
          resizeMode="cover"
          defaultSource={require('@/assets/images/icon.png')}
        />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.categoryBadge}>
          <Tag size={12} color={colors.text} />
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
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

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Could not connect to Freedom FM news server';
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color={colors.text} />
        <Text style={styles.errorTitle}>Failed to load news</Text>
        <Text style={styles.errorMessage}>
          {errorMessage}
        </Text>
        <Text style={[styles.errorMessage, { fontSize: 12, marginTop: 8 }]}>Please check your internet connection and try again</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={articles || []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 16 }
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={5}
        windowSize={10}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
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
