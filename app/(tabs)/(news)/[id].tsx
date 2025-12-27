import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Calendar, Tag, AlertCircle, Share2 } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import colors from '@/constants/colors';
import { NewsArticle } from '@/types';

const { width } = Dimensions.get('window');

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
      post = await response.json();
    } catch (parseError: any) {
      console.error('JSON Parse Error Details:');
      console.error('- Error:', parseError?.message || String(parseError));
      throw new Error('Unable to parse article data from server');
    }
    console.log('Successfully fetched article:', post.id);

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
    
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(article.link || '');
        Alert.alert('Link Copied', 'The article link has been copied to your clipboard.');
      } else {
        const shareContent = Platform.OS === 'ios'
          ? {
              message: `${article.title}\n\n${article.excerpt}`,
              url: article.link,
              title: article.title,
            }
          : {
              message: `${article.title}\n\n${article.excerpt}\n\nRead more: ${article.link}`,
              title: article.title,
            };
        
        const result = await Share.share(shareContent);
        
        if (result.action === Share.sharedAction) {
          console.log('Article shared successfully');
        }
      }
    } catch (error) {
      console.error('Error sharing article:', error);
      Alert.alert('Error', 'Could not share the article. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={styles.loadingText}>Loading article...</Text>
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
            <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
              <Share2 size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
    padding: 20,
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
    marginBottom: 40,
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
});
