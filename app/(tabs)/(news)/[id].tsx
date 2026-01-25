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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Calendar, Tag, AlertCircle, Share2 } from 'lucide-react-native';
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

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

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
    
    const headers: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
    
    let fetchUrl: string;
    if (Platform.OS === 'web') {
      fetchUrl = CORS_PROXY + encodeURIComponent(link);
    } else {
      fetchUrl = link;
      headers['User-Agent'] = Platform.OS === 'android' 
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      headers['Cache-Control'] = 'no-cache';
    }
    
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    
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
    
    // Extract main content from the article page
    let content = '';
    
    // Try to find entry-content div
    const entryContentMatch = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<footer|<aside|<nav|<section|$)/i);
    if (entryContentMatch) {
      content = entryContentMatch[1];
      console.log('[ARTICLE] Found entry-content, length:', content.length);
    }
    
    // Fallback: try article content
    if (!content) {
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) {
        content = articleMatch[1];
        console.log('[ARTICLE] Found article tag, length:', content.length);
      }
    }
    
    // Fallback: try post-content
    if (!content) {
      const postContentMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (postContentMatch) {
        content = postContentMatch[1];
        console.log('[ARTICLE] Found post-content, length:', content.length);
      }
    }
    
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
  
  // If we already have full content, return as is
  if (cachedArticle.content && cachedArticle.content.length > 100) {
    console.log('[ARTICLE] Cached article has content, returning');
    return cachedArticle;
  }
  
  // Fetch full content from the article link
  if (cachedArticle.link) {
    console.log('[ARTICLE] Fetching full content from:', cachedArticle.link);
    try {
      const fullContent = await fetchArticleContent(cachedArticle.link);
      if (fullContent && fullContent.length > 50) {
        console.log('[ARTICLE] Got full content, length:', fullContent.length);
        return {
          ...cachedArticle,
          content: fullContent,
        };
      }
    } catch (error: any) {
      console.log('[ARTICLE] Failed to fetch full content:', error?.message);
      // Return cached article with excerpt as fallback
    }
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const webHeaderTopInset = React.useMemo(() => {
    if (Platform.OS !== 'web') return insets.top;
    return Math.max(insets.top, 44);
  }, [insets.top]);

  // Get the article from the news list cache
  const getCachedArticle = (): NewsArticle | undefined => {
    const newsData = queryClient.getQueryData<NewsArticle[]>(['freedomFmNews']);
    if (newsData && id) {
      const found = newsData.find(article => article.id === id);
      console.log('[ARTICLE] Looking for cached article with id:', id, 'found:', !!found);
      return found;
    }
    return undefined;
  };

  const cachedArticle = getCachedArticle();

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id as string, cachedArticle),
    enabled: !!id && !!cachedArticle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const displayArticle = article || cachedArticle;

  const handleShare = useCallback(async () => {
    if (!displayArticle) {
      console.log('[NEWS][SHARE] No article to share');
      return;
    }

    console.log('[NEWS][SHARE] pressed', {
      platform: Platform.OS,
      id: displayArticle.id,
      link: displayArticle.link,
    });

    const shareUrl = displayArticle.link ?? '';
    const shareMessage = `${displayArticle.title}\n\n${displayArticle.excerpt}\n\n${shareUrl}`.trim();

    try {
      if (Platform.OS === 'web') {
        const nav = (globalThis as any)?.navigator as any;
        if (nav?.share) {
          console.log('[NEWS][SHARE] Using Web Share API');
          await nav.share({ title: displayArticle.title, text: `${displayArticle.title}\n\n${displayArticle.excerpt}`, url: shareUrl });
          return;
        }

        console.log('[NEWS][SHARE] Web Share API unavailable; copying link');
        if (shareUrl) {
          await Clipboard.setStringAsync(shareUrl);
          Alert.alert('Link Copied', 'The article link has been copied to your clipboard.');
        } else {
          Alert.alert('Nothing to share', 'This article does not have a valid link yet.');
        }
        return;
      }

      console.log('[NEWS][SHARE] Opening native share sheet');

      const result = await Share.share(
        Platform.OS === 'ios'
          ? {
              message: `${displayArticle.title}\n\n${displayArticle.excerpt}`,
              url: shareUrl,
              title: displayArticle.title,
            }
          : {
              message: shareMessage,
              title: displayArticle.title,
            },
        Platform.OS === 'android'
          ? {
              dialogTitle: 'Share article',
            }
          : undefined
      );

      console.log('[NEWS][SHARE] result', result);
    } catch (e) {
      console.error('[NEWS][SHARE] error', e);
      Alert.alert('Error', 'Could not open share options. Please try again.');
    }
  }, [displayArticle]);

  const handleBack = useCallback(() => {
    console.log('[NEWS][BACK] pressed');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/(news)/news');
    }
  }, [router]);

  if (isLoading && !cachedArticle) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Loading...',
            headerBackVisible: true,
          }}
        />
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
        <Stack.Screen
          options={{
            title: 'Error',
            headerBackVisible: true,
          }}
        />
        <AlertCircle size={48} color={colors.text} />
        <Text style={styles.errorTitle}>Failed to load article</Text>
        <Text style={styles.errorMessage}>
          {errorMessage}
        </Text>
        <Text style={[styles.errorMessage, { fontSize: 12, marginTop: 8 }]}>Please go back and try again</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <View style={[styles.webHeader, { paddingTop: webHeaderTopInset + 8 }]} testID="news-article-web-header">
          <TouchableOpacity
            onPress={handleBack}
            style={styles.webHeaderIconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="news-article-web-back"
          >
            <Text style={styles.webHeaderIconText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.webHeaderTitle} numberOfLines={1}>
            {displayArticle.title}
          </Text>

          <TouchableOpacity
            onPress={handleShare}
            style={styles.webHeaderIconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="news-article-web-share"
          >
            <Share2 size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      ) : (
        <Stack.Screen
          options={{
            title: displayArticle.title.length > 25 
              ? displayArticle.title.substring(0, 25) + '...' 
              : displayArticle.title,
            headerBackVisible: true,
            headerRight: () => (
              <TouchableOpacity
                onPress={handleShare}
                style={styles.shareButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="news-article-share"
              >
                <Share2 size={24} color={colors.text} />
              </TouchableOpacity>
            ),
          }}
        />
      )}

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

        <Text style={styles.title}>{displayArticle.title}</Text>

        <View style={styles.dateContainer}>
          <Calendar size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <Text style={styles.date}>{safeFormatLongDate(displayArticle.date)}</Text>
        </View>

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
