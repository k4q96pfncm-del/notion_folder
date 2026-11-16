import { Client } from "@notionhq/client";

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const apiKey = process.env.NOTION_API_KEY;
        const databaseId = process.env.NOTION_DATABASE_ID;

        if (!apiKey || !databaseId) {
            return res.status(500).json({ error: "환경 변수가 설정되지 않았습니다." });
        }

        const notion = new Client({ auth: apiKey });

        const response = await notion.databases.query({
            database_id: databaseId,
        });

        const pages = response.results.map((page) => {
            const props = page.properties;
            
            // 1. 타이틀 자동 추출
            let title = "제목 없음";
            for (const key of Object.keys(props)) {
                if (props[key].type === 'title' && props[key].title?.[0]?.plain_text) {
                    title = props[key].title[0].plain_text;
                    break;
                }
            }

            // 2. 상위 항목(Parent item) 속성 자동 감지 (타입이 relation인 속성 중 이름을 유추하거나 첫 번째 관계형 속성 활용)
            let parentId = null;
            let hasChildren = false;

            for (const key of Object.keys(props)) {
                const prop = props[key];
                // 노션에서 하위 항목을 켜면 보통 속성 이름에 '상위', 'Parent', '하위', 'Sub' 등이 포함됩니다.
                if (prop.type === 'relation') {
                    if (key.includes('상위') || key.toLowerCase().includes('parent')) {
                        parentId = prop.relation?.[0]?.id || null;
                    }
                    if (key.includes('하위') || key.toLowerCase().includes('sub')) {
                        hasChildren = prop.relation?.length > 0;
                    }
                }
            }

            return {
                id: page.id,
                title: title,
                url: page.url,
                parentId: parentId,
                hasChildren: hasChildren
            };
        });

        return res.status(200).json(pages);
    } catch (error) {
        console.error("Notion API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}