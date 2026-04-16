import { Aperture, Calendar, Camera, CheckCircle, HardDrive, Image, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ExifData } from '../types/exif';

type ResultsPanelProps = {
  exifData: ExifData;
  fileName: string;
  showRawData: boolean;
  onToggleRawData: () => void;
  onReset: () => void;
  formatOrientation: (code?: number) => string;
};

const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
    <span className="shrink-0 text-sm text-white/50 sm:text-base">{label}</span>
    <span className="min-w-0 break-words text-left font-medium text-white sm:text-right">{value}</span>
  </div>
);

const SectionCard = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 overflow-hidden">
    <div className="p-4 border-b border-white/10 bg-white/5">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
    </div>
    <div className="space-y-4 p-4 sm:p-6">{children}</div>
  </div>
);

export function ResultsPanel({
  exifData,
  fileName,
  showRawData,
  onToggleRawData,
  onReset,
  formatOrientation,
}: ResultsPanelProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 p-2 bg-purple-500/20 rounded-lg">
                <HardDrive className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="font-semibold text-white">文件信息</h2>
            </div>
            <button
              onClick={onReset}
              className="shrink-0 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              aria-label="重新上传"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          <InfoRow label="文件名" value={fileName} />
          <InfoRow label="文件类型" value={exifData.fileType || '-'} />
        </div>
      </div>

      <div className="flex items-center gap-2 text-green-400">
        <CheckCircle className="h-5 w-5 shrink-0" />
        <span className="font-medium">EXIF数据解析成功</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <SectionCard
          title="相机信息"
          icon={(
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Camera className="w-5 h-5 text-blue-400" />
            </div>
          )}
        >
          {exifData.make && <InfoRow label="制造商" value={exifData.make} />}
          {exifData.model && <InfoRow label="型号" value={exifData.model} />}
          {exifData.bodySerialNumber && <InfoRow label="机身序列号" value={exifData.bodySerialNumber} />}
          <div className={`-mx-2 flex flex-col gap-1 rounded-lg px-2 py-2 sm:flex-row sm:justify-between sm:gap-4 ${
            exifData.shutterCount !== undefined
              ? 'bg-green-500/10'
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            <span className={`font-medium ${exifData.shutterCount !== undefined ? 'text-green-400' : 'text-red-400'}`}>
              快门次数
            </span>
            {exifData.shutterCount !== undefined ? (
              <span className="text-green-400 font-bold text-lg">{exifData.shutterCount.toLocaleString()}</span>
            ) : (
              <span className="text-red-400 font-semibold sm:text-right">未读取到快门次数</span>
            )}
          </div>
          {exifData.software && <InfoRow label="软件" value={exifData.software} />}
          {exifData.lensModel && <InfoRow label="镜头" value={exifData.lensModel} />}
          {exifData.lensMake && <InfoRow label="镜头制造商" value={exifData.lensMake} />}
          {exifData.lensSerialNumber && <InfoRow label="镜头序列号" value={exifData.lensSerialNumber} />}
          {!exifData.make && !exifData.model && (
            <p className="text-white/40 text-center py-4">未检测到相机信息</p>
          )}
        </SectionCard>

        <SectionCard
          title="拍摄参数"
          icon={(
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Aperture className="w-5 h-5 text-green-400" />
            </div>
          )}
        >
          {exifData.aperture && <InfoRow label="光圈" value={exifData.aperture} />}
          {exifData.exposureTime && <InfoRow label="快门速度" value={exifData.exposureTime} />}
          {exifData.iso && <InfoRow label="ISO" value={exifData.iso} />}
          {exifData.focalLength && <InfoRow label="焦距" value={exifData.focalLength} />}
          {exifData.exposureBias && <InfoRow label="曝光补偿" value={exifData.exposureBias} />}
          {exifData.exposureMode && <InfoRow label="曝光模式" value={exifData.exposureMode} />}
          {!exifData.aperture && !exifData.exposureTime && !exifData.iso && (
            <p className="text-white/40 text-center py-4">未检测到拍摄参数</p>
          )}
        </SectionCard>

        <SectionCard
          title="拍摄时间"
          icon={(
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
          )}
        >
          {exifData.dateTimeOriginal && <InfoRow label="拍摄时间" value={exifData.dateTimeOriginal} />}
          {/*{exifData.dateTimeDigitized && <InfoRow label="数字化时间" value={exifData.dateTimeDigitized} />}*/}
          {!exifData.dateTimeOriginal && !exifData.dateTimeDigitized && (
            <p className="text-white/40 text-center py-4">未检测到时间信息</p>
          )}
        </SectionCard>

        <SectionCard
          title="图片信息"
          icon={(
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Image className="w-5 h-5 text-purple-400" />
            </div>
          )}
        >
          {exifData.imageWidth && exifData.imageHeight && (
            <InfoRow label="分辨率" value={`${exifData.imageWidth} x ${exifData.imageHeight}`} />
          )}
          {exifData.imageSize && <InfoRow label="尺寸" value={exifData.imageSize} />}
          {exifData.orientation && <InfoRow label="方向" value={formatOrientation(exifData.orientation)} />}
          {exifData.flash && <InfoRow label="闪光灯" value={exifData.flash} />}
          {exifData.whiteBalance && <InfoRow label="白平衡" value={exifData.whiteBalance} />}
          {exifData.meteringMode && <InfoRow label="测光模式" value={exifData.meteringMode} />}
          {exifData.colorSpace && <InfoRow label="色彩空间" value={exifData.colorSpace} />}
          {exifData.rating !== undefined && <InfoRow label="评分" value={`${exifData.rating} / 5`} />}
        </SectionCard>
      </div>

      <button
        onClick={onToggleRawData}
        className="w-full rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Info className="h-5 w-5 shrink-0 text-white/50" />
            <span className="text-white font-medium">查看原始EXIF数据</span>
          </div>
          <span className="shrink-0 text-white/50">{showRawData ? '收起' : '展开'}</span>
        </div>
      </button>

      {showRawData && exifData.rawData && (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
          <div className="p-4 border-b border-white/10 bg-white/5">
            <h3 className="font-medium text-white">原始数据</h3>
          </div>
          <div className="max-h-96 overflow-auto p-3 sm:p-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-white/70 sm:text-sm">
              {JSON.stringify(exifData.rawData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
