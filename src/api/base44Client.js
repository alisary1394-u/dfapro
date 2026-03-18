const apiFetch = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
};

const invokeMarketData = async (payload = {}) => {
  const { action, symbol, market = 'us', interval = 'daily' } = payload;

  if (action !== 'candles') {
    throw new Error(`Unsupported marketData action: ${action}`);
  }

  const data = await apiFetch(
    `/api/market/candles?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}&interval=${encodeURIComponent(interval)}`
  );

  return { data: { candles: data?.candles || [] } };
};

const invokeLLM = async (_options = {}) => {
  // Local fallback to keep AI panel functional when Base44 backend is unavailable.
  return {
    data: {
      trend: 'غير متاح',
      trend_reason: 'خدمة التحليل الذكي غير مفعلة حالياً في هذا الإصدار.',
      support: 0,
      resistance: 0,
      momentum: 'غير متاح',
      entry_point: 0,
      exit_point: 0,
      recommendation: 'انتظار',
      risk_level: 'متوسط',
      note: 'يمكنك تفعيل خدمة LLM لاحقاً أو ربط مزود بديل.',
      confidence: 0,
    },
  };
};

export const base44 = {
  functions: {
    invoke: async (name, payload) => {
      if (name === 'marketData') return invokeMarketData(payload);
      throw new Error(`Unsupported function: ${name}`);
    },
  },
  integrations: {
    Core: {
      InvokeLLM: invokeLLM,
    },
  },
};
