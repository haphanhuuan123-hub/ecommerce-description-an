export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productName, features, benefits, keywords } = req.body || {};

    if (!productName || !Array.isArray(features) || !Array.isArray(benefits) || !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Dữ liệu đầu vào không hợp lệ.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Thiếu GEMINI_API_KEY trong môi trường Vercel.' });
    }

    const prompt = `
Bạn là chuyên gia viết nội dung e-commerce bằng tiếng Việt.

Hãy tạo 3 phiên bản mô tả sản phẩm cho dữ liệu sau:

Tên sản phẩm: ${productName}

Các tính năng chính:
${features.map((item, index) => `${index + 1}. ${item}`).join('\n')}

Lợi ích chính cho khách hàng:
${benefits.map((item, index) => `${index + 1}. ${item}`).join('\n')}

Từ khóa SEO mục tiêu:
${keywords.join(', ')}

Yêu cầu:
1. Trả về đúng 3 phiên bản.
2. Mỗi phiên bản gồm:
- title
- bulletPoints (mảng 4 đến 6 ý)
- benefits
- seoLine
3. Viết hấp dẫn, dễ đọc, phù hợp sàn thương mại điện tử.
4. Tích hợp từ khóa SEO tự nhiên, không nhồi nhét.
5. Chỉ trả về JSON hợp lệ, không thêm giải thích ngoài JSON.

Định dạng JSON:
{
  "versions": [
    {
      "title": "string",
      "bulletPoints": ["string", "string"],
      "benefits": "string",
      "seoLine": "string"
    }
  ]
}
`.trim();

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: raw });
    }

    let apiData;
    try {
      apiData = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ error: 'Không đọc được phản hồi từ Gemini.' });
    }

    const text = apiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      return res.status(500).json({ error: 'Gemini không trả về nội dung.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      try {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e2) {
        return res.status(500).json({
          error: 'Gemini trả về nội dung không phải JSON hợp lệ.',
          rawText: text
        });
      }
    }

    if (!parsed.versions || !Array.isArray(parsed.versions)) {
      return res.status(500).json({ error: 'Gemini trả về sai cấu trúc versions.' });
    }

    return res.status(200).json({ versions: parsed.versions });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Lỗi server.' });
  }
}
