import type { Metadata } from 'next';
import './globals.css';
import I18nProvider from './i18n';
import { ThemeProvider } from '@/components/ThemeProvider';
import { DataProvider } from '@/components/DataProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import dynamic from 'next/dynamic';
import { Toaster } from 'sonner';

const ChatOverlay = dynamic(() => import('@/components/ChatOverlay'), { ssr: false });

export const metadata: Metadata = {
  title: 'TeamClaw - AI 团队协作平台',
  description: '把 AI 当队友，而不是工具',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <I18nProvider>
          <ThemeProvider>
            <ErrorBoundary>
              <DataProvider>
                {children}
                <ChatOverlay />
                <Toaster
                  position="top-center"
                  richColors
                  closeButton
                  toastOptions={{
                    duration: 3000,
                    style: {
                      fontSize: '14px',
                    },
                  }}
                />
              </DataProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
