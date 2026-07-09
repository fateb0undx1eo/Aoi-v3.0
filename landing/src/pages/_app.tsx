import Head from "next/head";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/components/theme-provider";
import { KeepAlive } from "@/components/keep-alive";
import { QueryProvider } from "@/lib/query-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { appThemes } from "@/lib/themes";
import "../styles/globals.css";
import "../styles/coolicons.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <title>AOI</title>
      </Head>
      <KeepAlive />
      <QueryProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={[...appThemes]}>
          <ErrorBoundary>
            <Component {...pageProps} />
          </ErrorBoundary>
        </ThemeProvider>
      </QueryProvider>
    </>
  );
}
