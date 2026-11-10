import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DEMO, session } from './session';
import { demoFetch } from './demo';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility to fetch API
export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  if (DEMO) return demoFetch(endpoint, options);
  const token = session.token();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      session.clear();
      window.location.href = '/login';
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'API request failed');
  }

  return response.json();
}
