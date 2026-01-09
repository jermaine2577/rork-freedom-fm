import React from 'react';
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
import { useLocalSearchParams, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Calendar, Tag, AlertCircle, Share2 } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
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

interface WordPressPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  date: string;
  link: string;
  categories: number[];
  _embedded?: {
    'wp:featuredmedia'?: {
      source_url: string;
    }[];
    'wp:term'?: {
      name: string;
    }[][];
  };
}

const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ');
};

const fetchArticle = async (id: string): Promise<NewsArticle> => {
  try {
    console.log('Fetching article:', id);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(
      `https://freedomfm1065.com/wp-json/wp/v2/posts/${id}?_embed`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': Platform.OS === 'android' ? 'FreedomFM-Android/1.0' : 'FreedomFM-iOS/1.0',
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    
    console.log('Article response status:', response.status);
    console.log('Article response content-type:', response.headers.get('content-type'));
    
    if (!response.ok) {
      console.error('Failed to fetch article:', response.status, response.statusText);
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      console.error('Server returned non-JSON response:', contentType);
      throw new Error('Server returned invalid content type');
    }
    
    let post: WordPressPost;
    try {
      const rawText = await response.text();
      console.log('Article response length:', rawText.length);
      console.log('Article first 200 chars:', rawText.substring(0, 200));
      
      let cleanedText = rawText.trim();
      
      // Clean up common issues on all platforms
      cleanedText = cleanedText
        .replace(/^\uFEFF/, '') // Remove BOM
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ''); // Remove control chars except tab/newline
      
      console.log('Cleaned article text first 200 chars:', cleanedText.substring(0, 200));
      console.log('First char code:', cleanedText.charCodeAt(0));
      
      // Validate that response looks like JSON
      if (!cleanedText.startsWith('[') && !cleanedText.startsWith('{')) {
        console.error('Response does not start with [ or {, starts with:', cleanedText.substring(0, 50));
        throw new Error('Invalid JSON response - does not start with array or object');
      }
      
      post = JSON.parse(cleanedText);
      console.log('Successfully fetched and parsed article:', post.id);
    } catch (parseError: any) {
      console.error('==================== JSON PARSE ERROR (Article) ====================');
      console.error('Platform:', Platform.OS);
      console.error('Article ID:', id);
      console.error('Error:', parseError?.message || String(parseError));
      console.error('Error name:', parseError?.name || 'unknown');
      console.error('Error stack:', parseError?.stack);
      console.error('====================================================================');
      throw new Error('Unable to parse article from server - invalid JSON format');
    }

    return {
      id: post.id.toString(),
      title: decodeHtmlEntities(post.title.rendered.replace(/<[^>]*>/g, '')),
      excerpt: decodeHtmlEntities(post.excerpt.rendered.replace(/<[^>]*>/g, '').trim()),
      content: post.content.rendered,
      imageUrl:
        post._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
        'https://via.placeholder.com/400x200',
      category: post._embedded?.['wp:term']?.[0]?.[0]?.name || 'News',
      date: post.date,
      link: post.link,
    };
  } catch (error: any) {
    console.error('Error fetching article:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'AbortError') {
      throw new Error('Connection timeout - The server is taking too long to respond');
    }
    
    if (error.message?.includes('Network request failed') || 
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('Load failed')) {
      throw new Error('Cannot connect to Freedom FM servers. Please check your internet connection and try again.');
    }
    
    if (error.message?.includes('JSON')) {
      throw new Error('Server returned invalid data format');
    }
    
    throw new Error(error.message || 'Failed to load article. Please try again later.');
  }
};

const cleanHtmlContent = (html: string): string => {
  return html
    .replace(/<p>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<h[1-6]>/g, '\n')
    .replace(/<\/h[1-6]>/g, '\n\n')
    .replace(/<li>/g, '\n• ')
    .replace(/<\/li>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: article, isLoading, error, refetch } = useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id as string),
    enabled: !!id,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleShare = async () => {
    if (!article) return;

    console.log('[NEWS][SHARE] pressed', {
      platform: Platform.OS,
      id: article.id,
      link: article.link,
    });

    const shareUrl = article.link ?? '';
    const shareMessage = `${article.title}\n\n${article.excerpt}\n\n${shareUrl}`.trim();

    try {
      if (Platform.OS === 'web') {
        const nav = (globalThis as any)?.navigator as any;
        if (nav?.share) {
          console.log('[NEWS][SHARE] Using Web Share API');
          await nav.share({ title: article.title, text: `${article.title}\n\n${article.excerpt}`, url: shareUrl });
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
              message: `${article.title}\n\n${article.excerpt}`,
              url: shareUrl,
              title: article.title,
            }
          : {
              message: shareMessage,
              title: article.title,
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
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <SkeletonArticle />
        </ScrollView>
      </View>
    );
  }

  if (error || (!article && !isLoading)) {
    const errorMessage = error instanceof Error ? error.message : 'Could not fetch article content';
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color={colors.text} />
        <Text style={styles.errorTitle}>Failed to load article</Text>
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

  if (!article) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color={colors.text} />
        <Text style={styles.errorTitle}>Article not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
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
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
      <Image source={{ uri: article.imageUrl }} style={styles.heroImage} />
      
      <View style={styles.content}>
        <View style={styles.categoryBadge}>
          <Tag size={14} color={colors.text} />
          <Text style={styles.categoryText}>{article.category}</Text>
        </View>

        <Text style={styles.title}>{article.title}</Text>

        <View style={styles.dateContainer}>
          <Calendar size={16} color={colors.textSecondary} />
          <Text style={styles.date}>
            {new Date(article.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.body}>
          {article.content ? cleanHtmlContent(article.content) : article.excerpt}
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
    gap: 6,
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
    gap: 8,
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
  shareButton: {
    padding: 8,
    marginRight: 8,
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
