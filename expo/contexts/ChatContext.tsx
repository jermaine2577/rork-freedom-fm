import { useCallback, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { ChatMessage } from '@/types';

const AVATARS = [
  '😎', '🎵', '🎸', '🎤', '🎧', '🎹', '🥁', '🎺', '🎻', '🎼'
];

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    username: 'MusicLover23',
    message: 'Great show tonight!',
    timestamp: Date.now() - 300000,
    avatar: '😎',
  },
  {
    id: '2',
    username: 'RadioFan',
    message: 'Can we get more classic rock?',
    timestamp: Date.now() - 180000,
    avatar: '🎵',
  },
  {
    id: '3',
    username: 'NightOwl',
    message: 'Listening from California! 🌴',
    timestamp: Date.now() - 120000,
    avatar: '🎧',
  },
];

export const [ChatProvider, useChat] = createContextHook(() => {
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [username, setUsername] = useState('');

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || !username.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      username: username.trim(),
      message: text.trim(),
      timestamp: Date.now(),
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    };

    setMessages((prev) => [...prev, newMessage]);
  }, [username]);

  return useMemo(
    () => ({
      messages,
      username,
      setUsername,
      sendMessage,
    }),
    [messages, username, sendMessage]
  );
});
