import { NewsArticle } from '@/types';

export const newsArticles: NewsArticle[] = [
  {
    id: 'fallback-1',
    title: 'Loading News from Freedom FM...',
    excerpt: 'Please pull down to refresh and load the latest news from Freedom FM 106.5.',
    imageUrl: 'https://freedomfm1065.com/wp-content/uploads/2024/01/freedom-fm-logo.png',
    date: new Date().toISOString(),
    category: 'News',
    link: 'https://freedomfm1065.com/news/',
  },
];
