import { defineConfig } from "vitepress";

export default defineConfig({
    title: "Zynora",
    description: "Folder-based icon font for the web — Vite plugin, SVG/PNG sources, Font Awesome–style classes.",
    lang: "en-US",
    lastUpdated: true,
    cleanUrls: true,

    themeConfig: {
        nav: [
            {
                text: "Guide",
                link: "/guide/introduction",
                activeMatch: "/guide/"
            },
            {
                text: "Icons",
                link: "/icons/gallery",
                activeMatch: "/icons/"
            }
        ],

        sidebar: {
            "/guide/": [
                {
                    text: "Getting started",
                    items: [
                        {
                            text: "Introduction",
                            link: "/guide/introduction"
                        },
                        {
                            text: "Installation & usage",
                            link: "/guide/installation-and-usage"
                        },
                        {
                            text: "Icon folders & metadata",
                            link: "/guide/icon-folders"
                        }
                    ]
                }
            ]
        },

        search: {
            provider: "local"
        },

        footer: {
            message: "Zynora icon set",
            copyright: "Private / UNLICENSED — replace brand marks with assets you may distribute."
        },

        outline: {
            level: [2, 3]
        }
    }
});
