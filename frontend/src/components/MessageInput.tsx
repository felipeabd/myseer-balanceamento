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
        resolve(result.split(',')[1]);
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
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Por favor, selecione apenas arquivos de imagem');
      return;
    }
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;

    e.preventDefault();
    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (!file) return;
      setImageFiles(prev => [...prev, file]);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const canSend = (message.trim() || imageFiles.length > 0) && !disabled;

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      {/* Image previews */}
      {imagePreviews.length > 0 && (
        <div className="mb-2 flex gap-2 flex-wrap px-1">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="h-16 w-16 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 transition-colors text-xs"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pill input */}
      <div
        className="flex items-end gap-2 rounded-2xl border bg-white px-3 py-2 transition-colors"
        style={{ borderColor: '#d1d5db' }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        {/* + button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Adicionar imagem"
          className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mb-0.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Pergunte sobre estoque, rupturas, balanceamento..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed"
          style={{ maxHeight: '160px', lineHeight: '1.5', paddingTop: '4px', paddingBottom: '4px' }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          title="Enviar (Enter)"
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all mb-0.5 disabled:cursor-not-allowed"
          style={
            canSend
              ? { background: 'linear-gradient(135deg, #2A81B8 0%, #494495 100%)' }
              : { backgroundColor: '#e5e7eb' }
          }
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke={canSend ? 'white' : '#9ca3af'}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <p className="mt-1.5 text-xs text-gray-400 text-center">
        Enter para enviar · Shift+Enter para nova linha
      </p>
    </div>
  );
}
