// Vercel Serverless Function - API 代理
// 用于解决 ReadHub API 的 CORS 跨域问题

const API_ORIGIN = 'https://api.readhub.cn';

export default async function handler(req, res) {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  // 只允许 GET 请求
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 从请求路径中提取 API 路径
    // 例如: /api/topic/daily → path = ['topic', 'daily']
    const { path, ...query } = req.query;
    
    // 构建目标 URL
    const apiPath = Array.isArray(path) ? path.join('/') : (path || '');
    const targetUrl = new URL(`/${apiPath}`, API_ORIGIN);
    
    // 添加查询参数
    Object.entries(query).forEach(([key, value]) => {
      targetUrl.searchParams.set(key, value);
    });

    console.log('Proxying request to:', targetUrl.toString());

    // 请求 ReadHub API
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ReadHub API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 设置 CORS 头并返回数据
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy failed', 
      message: error.message 
    });
  }
}
