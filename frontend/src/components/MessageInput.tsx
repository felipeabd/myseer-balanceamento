import { useState, type KeyboardEvent, useRef, useEffect } from 'react';

export interface ImageData {
  data: string;
  mediaType: string;
}

interface MessageInputProps {
  onSendMessage: (message: string, images?: ImageData[]) => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if ((message.trim() || imageFiles.length > 0) && !disabled) {
      // Convert images to base64 preserving media type
      const imageDataList: ImageData[] = [];
      for (const file of imageFiles) {
        const base64 = await fileToBase64(file);
        imageDataList.push({ data: base64, mediaType: file.type || 'image/jpeg' });
      }

      onSendMessage(message.trim() || '[Imagem enviada]', imageDataList.length > 0 ? imageDataList : undefined);
      setMessage('');
      clearImages();
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    // Create previews
    const previews: string[] = [];
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        previews.push(e.target?.result as string);
        if (previews.length === imageFiles.length) {
          setImagePreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });

    setImageFiles(imageFiles);
  };

  const clearImages = () => {
    setImageFiles([]);
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      {/* Image previews */}
      {imagePreviews.length > 0 && (
        <div className="mb-3 flex gap-2 flex-wrap">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="h-20 w-20 object-cover rounded border border-gray-300"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="rounded-lg border border-gray-300 px-3 py-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          title="Anexar imagem"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre estoque, rupturas, balanceamento..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{ maxHeight: '200px' }}
        />
        <button
          onClick={handleSend}
          disabled={(!message.trim() && imageFiles.length === 0) || disabled}
          className="rounded-lg px-6 py-3 font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          style={(!message.trim() && imageFiles.length === 0) || disabled ? {} : { background: 'linear-gradient(135deg, #2A81B8 0%, #494495 100%)' }}
        >
          Enviar
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Pressione Enter para enviar, Shift+Enter para nova linha. Anexe imagens para análise visual.
      </p>
    </div>
  );
}
