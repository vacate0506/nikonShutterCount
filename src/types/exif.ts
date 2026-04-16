export interface ExifData {
  imageWidth?: number;
  imageHeight?: number;
  imageSize?: string;
  fileType?: string;
  make?: string;
  model?: string;
  software?: string;
  bodySerialNumber?: string;
  shutterCount?: number;
  aperture?: string;
  exposureTime?: string;
  iso?: number;
  focalLength?: string;
  flash?: string;
  whiteBalance?: string;
  exposureMode?: string;
  meteringMode?: string;
  exposureBias?: string;
  dateTimeOriginal?: string;
  dateTimeDigitized?: string;
  lensModel?: string;
  lensMake?: string;
  lensSerialNumber?: string;
  orientation?: number;
  colorSpace?: string;
  rating?: number;
  rawData?: Record<string, any>;
}
