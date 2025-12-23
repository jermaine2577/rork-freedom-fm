import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { Calendar, Tag, AlertCircle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { NewsArticle } from '@/types';

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

const WORDPRESS_URL = 'https://freedomfm1065.com/wp-json/wp/v2/posts?_embed&per_page=20';
const USE_MOCK_DATA = false;
const FALLBACK_TO_MOCK_ON_ERROR = true;

const decodeHtmlEntities = (text: string): string => {
  return text
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

const fetchWordPressPosts = async (): Promise<NewsArticle[]> => {
  if (USE_MOCK_DATA) {
    console.log('Using mock data');
    await new Promise(resolve => setTimeout(resolve, 500));
    const { newsArticles } = await import('@/mocks/news');
    return newsArticles;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  
  try {
    console.log('Fetching WordPress posts from:', WORDPRESS_URL);
    
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      console.log('Request timed out after 15 seconds');
      controller.abort();
    }, 15000);
    
    const response = await fetch(WORDPRESS_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-cache',
    });
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('Failed to fetch posts:', response.status, response.statusText);
      throw new Error(`Server error: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    const responseText = await response.text();
    console.log('Response preview:', responseText.substring(0, 100));
    
    if (!contentType?.includes('application/json')) {
      console.error('Response is not JSON:', contentType);
      console.error('Response text:', responseText.substring(0, 200));
      throw new Error('Server returned invalid format');
    }
    
    let posts: WordPressPost[];
    try {
      posts = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Response text:', responseText.substring(0, 500));
      throw new Error('Invalid JSON response from server');
    }
    console.log('Successfully fetched', posts.length, 'posts');
    
    if (!Array.isArray(posts)) {
      throw new Error('Invalid data structure');
    }
    
    if (posts.length === 0) {
      throw new Error('No posts available');
    }
    
    return posts.map((post) => ({
      id: post.id.toString(),
      title: decodeHtmlEntities(post.title.rendered.replace(/<[^>]*>/g, '')),
      excerpt: decodeHtmlEntities(post.excerpt.rendered.replace(/<[^>]*>/g, '').trim()),
      content: post.content.rendered,
      imageUrl: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'https://via.placeholder.com/400x200',
      category: post._embedded?.['wp:term']?.[0]?.[0]?.name || 'News',
      date: post.date,
      link: post.link,
    }));
  } catch (error: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    console.error('Error fetching WordPress posts:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (FALLBACK_TO_MOCK_ON_ERROR) {
      console.log('Falling back to mock data due to error');
      await new Promise(resolve => setTimeout(resolve, 300));
      const { newsArticles } = await import('@/mocks/news');
      return newsArticles;
    }
    
    throw error;
  }
};

export default function NewsScreen() {
  const router = useRouter();
  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: ['wordpressNews'],
    queryFn: fetchWordPressPosts,
    retry: 2,
    retryDelay: 1000,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const [refreshing, setRefreshing] = useState(false);

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

  if (isLoading && !articles) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={styles.loadingText}>Loading news...</Text>
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
        contentContainerStyle={styles.listContent}
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
    padding: 16,
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
});
