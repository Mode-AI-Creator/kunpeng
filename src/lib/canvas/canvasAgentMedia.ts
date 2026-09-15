export const resolveCanvasAgentMediaUrl = async (url: string): Promise<string> => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        if (!url.includes('asset.localhost')) return url;
      }
      try {
        let localPath: string;
        if (url.startsWith('asset://') || url.startsWith('https://asset.localhost/')) {
          localPath = decodeURIComponent(
            url.replace(/^asset:\/\/localhost/, '').replace(/^https:\/\/asset\.localhost/, '')
          );
        } else if (url.startsWith('/')) {
          localPath = url;
        } else {
          return url;
        }
        const { uploadMediaSmart } = await import('@/lib/minioUpload');
        const fileName = localPath.split('/').pop() || `ref-${Date.now()}.png`;
        return await uploadMediaSmart(localPath, fileName);
      } catch (err) {
        console.warn('公网存储上传失败，传原始 URL:', err);
        return url;
      }
    };
