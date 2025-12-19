import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Prediction Market Indexer",
    description: "High-performance indexer for Prediction Markets (CTF/Polymarket)",
    base: "/prediction-market-indexer/", // Configured for GitHub Pages
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: 'Home', link: '/' },
            { text: 'API', link: '/api-reference' },
            { text: 'Schema', link: '/schema' }
        ],

        sidebar: [
            {
                text: 'Introduction',
                items: [
                    { text: 'Getting Started', link: '/getting-started' },
                    { text: 'Architecture', link: '/architecture' }
                ]
            }
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/smallyu/prediction-market-indexer' }
        ]
    }
})
