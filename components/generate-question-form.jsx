import { useState } from 'react';

export default function GenerateQuestionForm() {
  const [prompt, setPrompt] = useState('Tạo một câu hỏi trắc nghiệm về cấu trúc dữ liệu hàng đợi');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const generateQuestion = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      setResult(data.response || data); // mistral sẽ trả về data.response
    } catch (err) {
      setResult('Đã xảy ra lỗi khi gọi API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow-md max-w-xl mx-auto mt-10">
      <h2 className="text-lg font-semibold text-[#0f2a4e] mb-2">Sinh câu hỏi AI</h2>
      <textarea
        className="w-full p-2 border rounded mb-2"
        rows="3"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-[#123d73]"
        onClick={generateQuestion}
        disabled={loading}
      >
        {loading ? 'Đang tạo...' : 'Tạo câu hỏi'}
      </button>

      {result && (
        <div className="mt-4 p-3 bg-gray-50 border rounded text-sm whitespace-pre-line">
          <strong>Kết quả:</strong><br />
          {result}
        </div>
      )}
    </div>
  );
}
