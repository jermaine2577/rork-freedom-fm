export interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  date: string;
  category: string;
  content?: string;
  link?: string;
}

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  avatar: string;
}

export interface SongRequest {
  artist: string;
  song: string;
  message?: string;
  name: string;
}
