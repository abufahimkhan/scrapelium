import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Scrapelium",
    description: "A local-first desktop workspace for e-commerce product data.",
    icons: {
        icon: "/favicon.svg",
    },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
