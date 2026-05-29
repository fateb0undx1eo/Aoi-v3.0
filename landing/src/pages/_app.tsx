import type { AppProps } from "next/app";
import { ThemeProvider } from "@/components/theme-provider";
import { appThemes } from "@/lib/themes";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={[...appThemes]}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
