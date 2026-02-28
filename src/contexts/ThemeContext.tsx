import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  primary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  border: string;
  divider: string;
  disabled: string;
  placeholder: string;
}

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
}

const lightColors: ThemeColors = {
  background: '#F5F4EF',  // warm off-white (CRED-inspired)
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#111111',
  textSecondary: '#888888',
  primary: '#111111',     // near-black primary (CRED-style)
  success: '#00C48C',
  error: '#FF4757',
  warning: '#FFA502',
  info: '#2B7BE5',
  border: '#EBEBEB',
  divider: '#F0F0F0',
  disabled: '#CCCCCC',
  placeholder: '#AAAAAA',
};

const darkColors: ThemeColors = {
  background: '#0A0A0A',  // near-black (CRED dark)
  surface: '#181818',
  card: '#1C1C1C',
  text: '#FFFFFF',
  textSecondary: '#888888',
  primary: '#FFFFFF',     // white primary in dark (CRED-style)
  success: '#00C48C',
  error: '#FF4757',
  warning: '#FFA502',
  info: '#64B5F6',
  border: '#2A2A2A',
  divider: '#242424',
  disabled: '#444444',
  placeholder: '#666666',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('auto');
  
  // Determine if dark mode is active
  const isDark = theme === 'dark' || (theme === 'auto' && systemColorScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  // Load saved theme preference
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('app_theme');
      if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
        setThemeState(savedTheme as Theme);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      setThemeState(newTheme);
      await AsyncStorage.setItem('app_theme', newTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
