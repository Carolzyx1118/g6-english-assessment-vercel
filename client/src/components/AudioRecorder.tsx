import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Upload, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { isPersistedAudioUrl } from '@/lib/audioStorage';

interface AudioRecorderProps {
  questionId: number;
  sectionId: string;
  /** Current saved audio URL (if any) */
  savedUrl?: string;
  /** Called when audio is uploaded and URL is available */
  onRecorded: (url: string) => void;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeAudioBufferToWav(audioBuffer: AudioBuffer) {
  const channelCount = 1;
  const sampleRate = audioBuffer.sampleRate;
  const sampleCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;
  const output = new ArrayBuffer(44 + dataSize);
  const view = new DataView(output);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let mixedSample = 0;
    for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
      mixedSample += audioBuffer.getChannelData(channelIndex)[sampleIndex] || 0;
    }
    mixedSample /= Math.max(audioBuffer.numberOfChannels, 1);

    const clamped = Math.max(-1, Math.min(1, mixedSample));
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, Math.round(pcm), true);
    offset += bytesPerSample;
  }

  return output;
}

export default function AudioRecorder({ questionId, sectionId, savedUrl, onRecorded }: AudioRecorderProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'recorded' | 'uploading' | 'uploaded'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoUploadAttemptedRef = useRef(false);
  const uploadFileMutation = trpc.papers.uploadFile.useMutation();

  const isRevokableAudioUrl = useCallback((value: string) => {
    return value.startsWith('blob:');
  }, []);

  // Initialize with saved URL if available
  useEffect(() => {
    if (savedUrl && isPersistedAudioUrl(savedUrl)) {
      setStatus('uploaded');
      audioUrlRef.current = savedUrl;
    }
  }, [savedUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrlRef.current && isRevokableAudioUrl(audioUrlRef.current)) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [isRevokableAudioUrl]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Try webm first, fall back to mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      autoUploadAttemptedRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (audioUrlRef.current && isRevokableAudioUrl(audioUrlRef.current)) {
          URL.revokeObjectURL(audioUrlRef.current);
        }
        audioUrlRef.current = URL.createObjectURL(blob);
        setStatus('recorded');
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      recorder.start(200); // collect data every 200ms
      setStatus('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Recording error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Please allow microphone access to record.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Failed to start recording. Please try again.');
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const playAudio = useCallback(() => {
    const url = audioUrlRef.current;
    if (!url) return;

    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    const audio = new Audio(url);
    audioElementRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onpause = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const reRecord = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    if (audioUrlRef.current && isRevokableAudioUrl(audioUrlRef.current)) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = null;
    autoUploadAttemptedRef.current = false;
    setStatus('idle');
    setRecordingTime(0);
    setIsPlaying(false);
    setError(null);
  }, [isRevokableAudioUrl]);

  const blobToDataUrl = useCallback(async (blob: Blob) => {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to encode recording.'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to encode recording.'));
      reader.readAsDataURL(blob);
    });
  }, []);

  const blobToBase64 = useCallback(async (blob: Blob) => {
    const dataUrl = await blobToDataUrl(blob);
    const [, base64 = ''] = dataUrl.split(',', 2);
    if (!base64) {
      throw new Error('Failed to encode recording.');
    }
    return base64;
  }, [blobToDataUrl]);

  const getAudioExtension = useCallback((mimeType: string) => {
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('aac')) return 'aac';
    return 'webm';
  }, []);

  const convertBlobToWav = useCallback(async (blob: Blob) => {
    const AudioContextCtor = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

    if (!AudioContextCtor) {
      throw new Error('Audio conversion is not supported in this browser.');
    }

    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContextCtor();

    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const wavBuffer = encodeAudioBufferToWav(decoded);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } finally {
      await audioContext.close().catch(() => undefined);
    }
  }, []);

  const normalizeAudioBlobForScoring = useCallback(async (blob: Blob) => {
    const mimeType = blob.type.toLowerCase();
    if (mimeType.includes('wav') || mimeType.includes('mpeg') || mimeType.includes('mp3')) {
      return blob;
    }

    try {
      return await convertBlobToWav(blob);
    } catch (error) {
      console.warn('Failed to convert recording to WAV before upload.', error);
      return blob;
    }
  }, [convertBlobToWav]);

  const uploadAudio = useCallback(async () => {
    if (!chunksRef.current.length) return;

    setStatus('uploading');
    setError(null);

    try {
      const mimeType = chunksRef.current[0].type || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const normalizedBlob = await normalizeAudioBlobForScoring(blob);
      const normalizedMimeType = normalizedBlob.type || mimeType;
      const provisionalDataUrl = await blobToDataUrl(normalizedBlob);
      onRecorded(provisionalDataUrl);
      let persistedUrl: string;

      try {
        const fileBase64 = await blobToBase64(normalizedBlob);
        const extension = getAudioExtension(normalizedMimeType);
        const uploaded = await uploadFileMutation.mutateAsync({
          fileName: `speaking-${sectionId}-${questionId}-${Date.now()}.${extension}`,
          fileBase64,
          contentType: normalizedMimeType,
        });
        persistedUrl = uploaded.url;
      } catch (uploadError) {
        console.warn('Recording upload failed, falling back to embedded audio.', uploadError);
        persistedUrl = provisionalDataUrl;
      }

      audioUrlRef.current = persistedUrl;
      setStatus('uploaded');
      setError(null);
      if (persistedUrl !== provisionalDataUrl) {
        onRecorded(persistedUrl);
      }
    } catch (err: any) {
      console.error('Recording save error:', err);
      setError(typeof err?.message === 'string' && err.message.trim() ? err.message : 'Failed to save recording. Please try again.');
      setStatus('recorded');
    }
  }, [blobToBase64, blobToDataUrl, getAudioExtension, normalizeAudioBlobForScoring, onRecorded, questionId, sectionId, uploadFileMutation]);

  useEffect(() => {
    if (status !== 'recorded' || autoUploadAttemptedRef.current || chunksRef.current.length === 0) {
      return;
    }

    autoUploadAttemptedRef.current = true;
    void uploadAudio();
  }, [status, uploadAudio]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-slate-50/50 p-4 space-y-3">
      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm">
        {status === 'idle' && (
          <span className="text-slate-500">Press the button to start recording</span>
        )}
        {status === 'recording' && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-red-600 font-medium">Recording... {formatTime(recordingTime)}</span>
          </div>
        )}
        {status === 'recorded' && (
          <span className="text-blue-600 font-medium">Recording complete ({formatTime(recordingTime)})</span>
        )}
        {status === 'uploading' && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-blue-600 font-medium">Saving...</span>
          </div>
        )}
        {status === 'uploaded' && (
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-600 font-medium">Recording saved</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {status === 'idle' && (
          <Button
            onClick={startRecording}
            variant="default"
            size="sm"
            className="gap-2 bg-red-500 hover:bg-red-600 text-white"
          >
            <Mic className="w-4 h-4" />
            Start Recording
          </Button>
        )}

        {status === 'recording' && (
          <Button
            onClick={stopRecording}
            variant="default"
            size="sm"
            className="gap-2 bg-slate-700 hover:bg-slate-800 text-white"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </Button>
        )}

        {(status === 'recorded' || status === 'uploaded') && (
          <>
            <Button
              onClick={isPlaying ? pauseAudio : playAudio}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>

            <Button
              onClick={reRecord}
              variant="outline"
              size="sm"
              className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <RotateCcw className="w-4 h-4" />
              Re-record
            </Button>

            {status === 'recorded' && (
              <Button
                onClick={uploadAudio}
                variant="default"
                size="sm"
                className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Upload className="w-4 h-4" />
                Save Recording
              </Button>
            )}
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
    </div>
  );
}
