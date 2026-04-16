import { useState, useCallback } from 'react';
import ExifReader from 'exifreader';
import { Upload, Camera, Aperture, Smartphone, AlertCircle, HardDrive } from 'lucide-react';

import type { ExifData } from './types/exif';
import { ResultsPanel } from './components/ResultsPanel';
import { parseNikonShutterCountFromBuffer } from './lib/nikonShutterCount';

const SUPPORTED_RAW_FORMATS = ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw', '.3fr', '.mef', '.nrw', '.raw', '.rwl', '.sr2'];

const SHUTTER_COUNT_TAGS = [
  'ShutterCount',
  'shutter count',
  'ShutterCounter',
  'Shutter Actuation',
  'NumberOfShots',
  'ExposureCount',
  'Shutter actuation count',
  'FrameCount',
  'Frame number',
  'ShutterOperations',
  'ElectronicallyControlled',
  'TotalShutter',
  'ImageNumber',
  'aux:ImageNumber',
  'FileNumber',
  'ShotNumber',
  'Actuations',
  'Shutter actuations',
  'Shutter_Firing',
  'Counter',
  'MakerNote:ShutterCount',
  'MakerNote:Shutter Count',
];

function App() {
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [fileName, setFileName] = useState<string>('');

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : '';
  };

  const isRawFormat = (filename: string): boolean => {
    const ext = getFileExtension(filename);
    return SUPPORTED_RAW_FORMATS.includes(ext);
  };

  const parseFlash = (code?: number): string => {
    if (code === undefined) return '未知';
    const flashStates: Record<number, string> = {
      0: '无闪光',
      1: '闪光灯开启',
      5: '闪光灯开启(无红眼)',
      7: '闪光灯开启(有红眼)',
      8: '闪光灯关闭',
      9: '闪光灯开启(强制)',
      13: '闪光灯开启(强制,无红眼)',
      15: '闪光灯开启(强制,有红眼)',
      16: '闪光灯关闭(强制)',
      24: '自动闪光灯关闭',
      25: '自动闪光灯开启',
      29: '自动闪光灯开启(无红眼)',
      31: '自动闪光灯开启(有红眼)',
    };
    return flashStates[code] || `代码: ${code}`;
  };

  const parseWhiteBalance = (code?: number): string => {
    if (code === undefined) return '未知';
    const modes: Record<number, string> = {
      0: '自动',
      1: '日光',
      2: '荧光灯',
      3: '白炽灯',
      4: '闪光灯',
      5: '阴天',
      6: '阴影',
      7: '色温设定',
      8: '自定义',
      9: '自动(色温优先)',
      10: '色温优先',
    };
    return modes[code] || `代码: ${code}`;
  };

  const parseExposureMode = (code?: number): string => {
    if (code === undefined) return '未知';
    const modes: Record<number, string> = {
      0: '自动',
      1: '手动曝光',
      2: '自动包围曝光',
      3: '光圈优先',
      4: '快门优先',
    };
    return modes[code] || `代码: ${code}`;
  };

  const parseMeteringMode = (code?: number): string => {
    if (code === undefined) return '未知';
    const modes: Record<number, string> = {
      0: '未知',
      1: '平均测光',
      2: '中央重点测光',
      3: '点测光',
      4: '多点测光',
      5: '矩阵测光',
      6: '部分测光',
    };
    return modes[code] || `代码: ${code}`;
  };

  const parseOrientation = (code?: number): string => {
    if (code === undefined) return '未知';
    const modes: Record<number, string> = {
      1: '横向',
      2: '镜像横向',
      3: '旋转180°',
      4: '镜像旋转180°',
      5: '镜像旋转270°',
      6: '旋转90°',
      7: '镜像旋转90°',
      8: '旋转270°',
    };
    return modes[code] || `代码: ${code}`;
  };

  const parseExposureTime = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    if (num < 1) {
      return `1/${Math.round(1 / num)}s`;
    }
    return `${num}s`;
  };

  const parseFNumber = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return `f/${num}`;
  };

  const parseFocalLength = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return `${num}mm`;
  };

  const getTagValue = (tag: any): any => {
    if (!tag) return undefined;
    if (tag.description !== undefined) return tag.description;
    if (tag.value !== undefined) return tag.value;
    return tag;
  };

  const parseNumber = (value: any): number | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      return isNaN(num) ? undefined : num;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const num = parseNumber(item);
        if (num !== undefined) return num;
      }
      return undefined;
    }
    if (typeof value === 'object') {
      if (value.value !== undefined) {
        return parseNumber(value.value);
      }
      if (value.description !== undefined) {
        return parseNumber(value.description);
      }
    }
    return undefined;
  };

  const normalizeTagName = (name: string): string => {
    return name
      .replace(/^[^:]+:/, '')
      .replace(/[\s_-]/g, '')
      .toLowerCase();
  };

  const findTagValueDeep = (
    source: any,
    candidateNames: string[] | Set<string>,
    visited = new WeakSet<object>()
  ): any => {
    if (!source || typeof source !== 'object') return undefined;
    if (visited.has(source)) return undefined;
    visited.add(source);

    const normalizedCandidates = candidateNames instanceof Set
      ? candidateNames
      : new Set(candidateNames.map(normalizeTagName));

    for (const [key, value] of Object.entries(source)) {
      if (normalizedCandidates.has(normalizeTagName(key))) {
        const tagValue = getTagValue(value);
        if (tagValue !== undefined && tagValue !== null && tagValue !== '') {
          return tagValue;
        }
      }
    }

    for (const value of Object.values(source)) {
      if (value && typeof value === 'object') {
        const nestedValue = findTagValueDeep(value, candidateNames, visited);
        if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
          return nestedValue;
        }
      }
    }

    return undefined;
  };

  const parseShutterCount = (tags: any): number | undefined => {
    const directValue = findTagValueDeep(tags, SHUTTER_COUNT_TAGS);
    if (directValue !== undefined) {
      const num = parseNumber(directValue);
      if (num !== undefined && num > 0 && num < 100000000) {
        return num;
      }
    }

    return undefined;
  };

  const parseExif = async (file: File): Promise<ExifData> => {
    const exif: ExifData = {
      fileType: isRawFormat(file.name) ? 'RAW' : file.type || 'Unknown'
    };

    try {
      const arrayBuffer = await file.arrayBuffer();
      const tags = ExifReader.load(arrayBuffer, { expanded: true }) as any;

      // Store raw data for debugging
      exif.rawData = tags;

      // Image dimensions from various sources
      const imageTags = tags.image || {};
      const exifTags = tags.exif || {};
      const xmpTags = tags.xmp || {};

      if (imageTags['Image Width']) {
        exif.imageWidth = parseNumber(imageTags['Image Width']);
      }
      if (imageTags['Image Height']) {
        exif.imageHeight = parseNumber(imageTags['Image Height']);
      }
      if (exifTags['PixelXDimension']) {
        exif.imageWidth = parseNumber(exifTags['PixelXDimension']);
      }
      if (exifTags['PixelYDimension']) {
        exif.imageHeight = parseNumber(exifTags['PixelYDimension']);
      }

      if (exif.imageWidth && exif.imageHeight) {
        const megapixels = (exif.imageWidth * exif.imageHeight) / 1000000;
        exif.imageSize = `${exif.imageWidth} x ${exif.imageHeight} (${megapixels.toFixed(1)}MP)`;
      }

      // Camera Info
      exif.make = getTagValue(imageTags.Make) || getTagValue(exifTags.Make);
      exif.model = getTagValue(imageTags.Model) || getTagValue(exifTags.Model);
      exif.software = getTagValue(imageTags.Software) || getTagValue(exifTags.Software);

      // Serial numbers - including XMP aux namespace
      exif.bodySerialNumber = getTagValue(exifTags.BodySerialNumber)
        || getTagValue(exifTags.InternalSerialNumber)
        || getTagValue(exifTags.SerialNumber)
        || getTagValue(exifTags.CameraSerialNumber)
        || getTagValue(xmpTags['aux:SerialNumber'])
        || getTagValue(xmpTags.SerialNumber);

      // Shutter Count - enhanced parsing including XMP aux namespace
      // First, collect all tags from various sources
      const allTags: any = { ...imageTags, ...exifTags, ...(tags.makerNotes || {}), ...xmpTags };

      // Parse XMP aux:ImageNumber as shutter count. Some RAW files expose it as
      // aux:ImageNumber in the embedded XMP packet instead of a normal EXIF tag.
      const xmpImageNumber = findTagValueDeep(xmpTags, ['aux:ImageNumber', 'ImageNumber']);
      if (xmpImageNumber !== undefined) {
        const xmpNum = parseNumber(xmpImageNumber);
        if (xmpNum !== undefined && xmpNum > 0 && xmpNum < 100000000) {
          exif.shutterCount = xmpNum;
        }
      }

      // If not found in XMP, try other sources
      if (exif.shutterCount === undefined) {
        exif.shutterCount = parseShutterCount(allTags);
      }

      // Fallback based on app.js: read Nikon MakerNote tag 0x00a7 directly
      // from the original TIFF/NEF/JPEG binary when ExifReader does not expose it.
      if (exif.shutterCount === undefined) {
        exif.shutterCount = parseNikonShutterCountFromBuffer(arrayBuffer);
      }

      // Lens Info - including XMP aux namespace
      exif.lensModel = getTagValue(exifTags.LensModel)
        || getTagValue(exifTags.Lens)
        || getTagValue(xmpTags['aux:Lens'])
        || getTagValue(xmpTags.Lens);
      exif.lensMake = getTagValue(exifTags.LensMake);
      exif.lensSerialNumber = getTagValue(exifTags.LensSerialNumber)
        || getTagValue(exifTags.LensID)
        || getTagValue(xmpTags['aux:LensSerialNumber'])
        || getTagValue(xmpTags.LensSerialNumber);

      // Shooting Parameters
      const fNumber = getTagValue(exifTags.FNumber) || getTagValue(exifTags.ApertureValue);
      exif.aperture = parseFNumber(fNumber);

      const exposureTime = getTagValue(exifTags.ExposureTime) || getTagValue(exifTags.ShutterSpeedValue);
      exif.exposureTime = parseExposureTime(exposureTime);

      const iso = getTagValue(exifTags.ISOSpeedRatings) || getTagValue(exifTags.ISO);
      const isoNum = parseNumber(iso);
      if (isoNum !== undefined) exif.iso = isoNum;

      const focalLength = getTagValue(exifTags.FocalLength);
      exif.focalLength = parseFocalLength(focalLength);

      const flash = parseNumber(getTagValue(exifTags.Flash));
      if (flash !== undefined) exif.flash = parseFlash(flash);

      const whiteBalance = parseNumber(getTagValue(exifTags.WhiteBalance));
      if (whiteBalance !== undefined) exif.whiteBalance = parseWhiteBalance(whiteBalance);

      const exposureMode = parseNumber(getTagValue(exifTags.ExposureMode));
      if (exposureMode !== undefined) exif.exposureMode = parseExposureMode(exposureMode);

      const meteringMode = parseNumber(getTagValue(exifTags.MeteringMode));
      if (meteringMode !== undefined) exif.meteringMode = parseMeteringMode(meteringMode);

      // Date/Time
      exif.dateTimeOriginal = getTagValue(exifTags.DateTimeOriginal)
        || getTagValue(exifTags.CreateDate);
      // exif.dateTimeDigitized = getTagValue(exifTags.DateTimeDigitized)
      //   || getTagValue(exifTags.DigitizeDate);

      // Orientation
      const orientation = parseNumber(getTagValue(exifTags.Orientation) || getTagValue(imageTags.Orientation));
      if (orientation !== undefined) exif.orientation = orientation;

      // Color Space
      const colorSpace = parseNumber(getTagValue(exifTags.ColorSpace));
      if (colorSpace === 1) exif.colorSpace = 'sRGB';
      else if (colorSpace === 2) exif.colorSpace = 'Adobe RGB';

      // Exposure Bias
      const biasValue = getTagValue(exifTags.ExposureBiasValue);
      if (biasValue !== undefined) {
        const biasNum = parseNumber(biasValue);
        if (biasNum !== undefined) {
          exif.exposureBias = biasNum >= 0 ? `+${biasNum.toFixed(1)} EV` : `${biasNum.toFixed(1)} EV`;
        }
      }

      // Rating
      const rating = parseNumber(getTagValue(exifTags.Rating));
      if (rating !== undefined) exif.rating = rating;

    } catch (err) {
      console.error('ExifReader parse error:', err);
      throw err;
    }

    return exif;
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/') && !isRawFormat(file.name)) {
      setError('请上传图片或RAW文件');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      // Create preview for non-RAW files
      const ext = getFileExtension(file.name);
      if (['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'].includes(ext)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        // For RAW files, show a placeholder
        setImagePreview(null);
      }

      // Parse EXIF
      const exif = await parseExif(file);
      setExifData(exif);
    } catch (err) {
      console.error('Parse error:', err);
      setError(err instanceof Error ? err.message : '解析EXIF数据时出错');
      setExifData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const resetAnalysis = () => {
    setExifData(null);
    setImagePreview(null);
    setError(null);
    setShowRawData(false);
    setFileName('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">EXIF 信息读取</h1>
              <p className="text-sm text-white/60">图片元数据分析工具</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Upload Area */}
        {!imagePreview && !exifData && (
          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
              isDragging
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              accept="image/*,.nef,.cr2,.cr3,.arw,.dng,.raf,.orf,.rw2,.pef,.srw,.3fr,.mef,.nrw,.raw,.rwl,.sr2"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center gap-4">
              <div className={`p-6 rounded-full bg-white/5 transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
                <Upload className={`w-12 h-12 text-purple-400 ${isDragging ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <p className="text-lg font-medium text-white">
                  点击选择图片或拖动文件到这里
                </p>
                <p className="text-sm text-white/50 mt-1">
                  支持 JPG、RAW 格式（NEF）
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white/70">正在解析EXIF数据...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-8 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-400">解析失败</h3>
                <p className="text-red-300/80 mt-1">{error}</p>
                <button
                  onClick={resetAnalysis}
                  className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                >
                  重新上传
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {exifData && !isLoading && (
          <ResultsPanel
            exifData={exifData}
            fileName={fileName}
            showRawData={showRawData}
            onToggleRawData={() => setShowRawData((visible) => !visible)}
            onReset={resetAnalysis}
            formatOrientation={parseOrientation}
          />
        )}

        {/* Features Section */}
        {!imagePreview && !exifData && (
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
              <div className="p-3 bg-blue-500/20 rounded-xl w-fit mb-4">
                <Smartphone className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">相机信息</h3>
              <p className="text-sm text-white/60">自动识别相机品牌、型号和镜头信息</p>
            </div>

            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
              <div className="p-3 bg-green-500/20 rounded-xl w-fit mb-4">
                <Aperture className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">拍摄参数</h3>
              <p className="text-sm text-white/60">显示光圈、快门速度、ISO等详细参数</p>
            </div>

            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
              <div className="p-3 bg-purple-500/20 rounded-xl w-fit mb-4">
                <HardDrive className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">RAW格式支持</h3>
              <p className="text-sm text-white/60">支持NEF格式</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-white/40">
          EXIF 信息读取工具 · 纯前端处理，保护您的隐私
        </div>
      </footer>
    </div>
  );
}

export default App;

