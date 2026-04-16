type TiffEntry = {
  type: number;
  count: number;
  valueOffset: number;
};

const readAscii = (view: DataView, offset: number, length: number): string => {
  let result = '';
  for (let index = 0; index < length && offset + index < view.byteLength; index += 1) {
    result += String.fromCharCode(view.getUint8(offset + index));
  }
  return result;
};

const isValidOffset = (view: DataView, offset: number, length = 1): boolean => {
  return offset >= 0 && length >= 0 && offset + length <= view.byteLength;
};

const getTiffStart = (view: DataView): number | undefined => {
  if (view.byteLength > 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (isValidOffset(view, offset, 4)) {
      if (view.getUint8(offset) !== 0xff) return undefined;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda || marker === 0xd9) return undefined;

      const segmentLength = view.getUint16(offset + 2, false);
      if (segmentLength < 2 || !isValidOffset(view, offset + 2, segmentLength)) {
        return undefined;
      }
      if (marker === 0xe1 && readAscii(view, offset + 4, 6) === 'Exif\u0000\u0000') {
        return offset + 10;
      }
      offset += 2 + segmentLength;
    }
    return undefined;
  }

  if (view.byteLength >= 8) {
    const byteOrder = readAscii(view, 0, 2);
    if (byteOrder === 'II' || byteOrder === 'MM') return 0;
  }

  return undefined;
};

const readIfdEntries = (
  view: DataView,
  ifdOffset: number,
  littleEndian: boolean
): Map<number, TiffEntry> => {
  const entries = new Map<number, TiffEntry>();
  if (!isValidOffset(view, ifdOffset, 2)) return entries;

  const entryCount = view.getUint16(ifdOffset, littleEndian);
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (!isValidOffset(view, entryOffset, 12)) break;

    entries.set(view.getUint16(entryOffset, littleEndian), {
      type: view.getUint16(entryOffset + 2, littleEndian),
      count: view.getUint32(entryOffset + 4, littleEndian),
      valueOffset: entryOffset + 8,
    });
  }

  return entries;
};

const getTagDataOffset = (
  view: DataView,
  tiffStart: number,
  entry: TiffEntry,
  littleEndian: boolean
): { offset: number; byteCount: number } | undefined => {
  const typeSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const unitSize = typeSizes[entry.type];
  if (!unitSize) return undefined;

  const byteCount = unitSize * entry.count;
  const offset = byteCount <= 4
    ? entry.valueOffset
    : tiffStart + view.getUint32(entry.valueOffset, littleEndian);

  if (!isValidOffset(view, offset, byteCount)) return undefined;
  return { offset, byteCount };
};

const readNumericTag = (
  view: DataView,
  tiffStart: number,
  entry: TiffEntry,
  littleEndian: boolean
): number | undefined => {
  const data = getTagDataOffset(view, tiffStart, entry, littleEndian);
  if (!data || entry.count < 1) return undefined;

  switch (entry.type) {
    case 3:
      return view.getUint16(data.offset, littleEndian);
    case 4:
      return view.getUint32(data.offset, littleEndian);
    case 9:
      return view.getInt32(data.offset, littleEndian);
    default:
      return undefined;
  }
};

const parseMakerNoteShutterCount = (
  view: DataView,
  makerNoteOffset: number,
  makerNoteLength: number,
  defaultLittleEndian: boolean
): number | undefined => {
  if (!isValidOffset(view, makerNoteOffset, makerNoteLength) || makerNoteLength < 18) {
    return undefined;
  }
  if (!readAscii(view, makerNoteOffset, 10).startsWith('Nikon')) return undefined;

  const makerTiffStart = makerNoteOffset + 10;
  const byteOrder = readAscii(view, makerTiffStart, 2);
  const littleEndian = byteOrder === 'II' ? true : byteOrder === 'MM' ? false : defaultLittleEndian;
  if (!isValidOffset(view, makerTiffStart, 8)) return undefined;
  if (view.getUint16(makerTiffStart + 2, littleEndian) !== 0x002a) return undefined;

  const firstIfdOffset = view.getUint32(makerTiffStart + 4, littleEndian);
  const makerEntries = readIfdEntries(view, makerTiffStart + firstIfdOffset, littleEndian);
  const shutterEntry = makerEntries.get(0x00a7);
  if (!shutterEntry) return undefined;

  const shutterCount = readNumericTag(view, makerTiffStart, shutterEntry, littleEndian);
  return shutterCount !== undefined && shutterCount > 0 && shutterCount < 100000000
    ? shutterCount
    : undefined;
};

export const parseNikonShutterCountFromBuffer = (arrayBuffer: ArrayBuffer): number | undefined => {
  const view = new DataView(arrayBuffer);
  const tiffStart = getTiffStart(view);
  if (tiffStart === undefined || !isValidOffset(view, tiffStart, 8)) return undefined;

  const byteOrder = readAscii(view, tiffStart, 2);
  const littleEndian = byteOrder === 'II' ? true : byteOrder === 'MM' ? false : undefined;
  if (littleEndian === undefined || view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) {
    return undefined;
  }

  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const mainEntries = readIfdEntries(view, tiffStart + firstIfdOffset, littleEndian);
  const exifIfdPointer = mainEntries.get(0x8769);
  const exifOffset = exifIfdPointer
    ? readNumericTag(view, tiffStart, exifIfdPointer, littleEndian)
    : undefined;
  if (exifOffset === undefined) return undefined;

  const exifEntries = readIfdEntries(view, tiffStart + exifOffset, littleEndian);
  const makerNoteEntry = exifEntries.get(0x927c);
  if (!makerNoteEntry) return undefined;

  const makerNoteData = getTagDataOffset(view, tiffStart, makerNoteEntry, littleEndian);
  if (!makerNoteData) return undefined;

  return parseMakerNoteShutterCount(
    view,
    makerNoteData.offset,
    makerNoteData.byteCount,
    littleEndian
  );
};
