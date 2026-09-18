import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { randomUUID } from '@/lib/uuid';
import { getKimiK3Config } from './kimiClient';

/** Videos at or below this size ride the prompt as inline base64 blocks. */
export const KIMI_INLINE_VIDEO_MAX_BYTES = 12 * 1024 * 1024;
/** Kimi file service accepts uploads up to this size. */
export const KIMI_FILE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

interface KimiUploadEvent {
  uploadId: string;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
}

interface KimiUploadResult {
  fileId: string;
  url: string;
}

export interface KimiVideoUploadProgress {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
}

export async function uploadVideoToKimi(
  filePath: string,
  onProgress?: (progress: KimiVideoUploadProgress) => void,
): Promise<KimiUploadResult> {
  const config = getKimiK3Config();
  if (!config) throw new Error('未配置 Kimi API Key');

  const uploadId = `kimi-video-${randomUUID()}`;
  let unlisten: UnlistenFn | undefined;
  try {
    unlisten = await listen<KimiUploadEvent>('kimi-video-upload-progress', ({ payload }) => {
      if (payload.uploadId !== uploadId) return;
      onProgress?.({
        loadedBytes: payload.loadedBytes,
        totalBytes: payload.totalBytes,
        percent: payload.percent,
      });
    });
    return await invoke<KimiUploadResult>('kimi_upload_video', {
      apiKey: config.apiKey,
      baseUrl: config.anthropicBaseUrl,
      filePath,
      uploadId,
    });
  } finally {
    unlisten?.();
  }
}
