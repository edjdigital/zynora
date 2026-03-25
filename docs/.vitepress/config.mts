import { defineConfig } from "vitepress";

export default defineConfig({
    title: "Zynora",
    description: "Complete icon toolkit with SVG, font, and CSS support, built for modern design systems and developer workflows.",
    lang: "en-US",
    // VitePress uses `git` for timestamps; Docker/Dokploy often has no git binary or no `.git` in context.
    lastUpdated: process.env.ZYNORA_DOCS_NO_GIT === "1" ? false : true,
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
            message: "Icon font toolkit by the Even7 team",
            copyright: "MIT - replace brand marks with assets you may distribute."
        },

        outline: {
            level: [2, 3]
        }
    }
});
