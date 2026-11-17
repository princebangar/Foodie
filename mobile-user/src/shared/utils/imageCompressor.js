const DEFAULT_MAX_WIDTH = 2048
const DEFAULT_MAX_HEIGHT = 2048
const DEFAULT_QUALITY = 0.88
const DEFAULT_MAX_BYTES = Math.floor(4.5 * 1024 * 1024)
const SMALL_SKIP_THRESHOLD = Math.floor(900 * 1024)
const MIN_QUALITY = 0.55
const QUALITY_STEP = 0.05

export const PROFILE_PRESET = {
  maxWidth: 1024,
  maxHeight: 1024,
  maxBytes: 2 * 1024 * 1024,
  quality: 0.88,
}

export async function compressImageForUpload(file, options = {}) {
  // In the app a picked photo is a { uri, name, type } descriptor from src/lib/media.js pickImage(), which the system
  // picker already re-encodes (quality 0.8) - there is no canvas to re-encode it again. Browser Blobs never occur here.
  // The size options are accepted so the callers stay as on the web.
  void options
  return file
}

export const compressImagesForUpload = async (files, options = {}) => {
  const normalizedFiles = Array.from(files || []).filter(Boolean)
  return Promise.all(
    normalizedFiles.map((file) => compressImageForUpload(file, options)),
  )
}

export const prepareUploadFile = async (file, options = {}) =>
  compressImageForUpload(file, options)

export const prepareUploadFiles = async (files, options = {}) =>
  compressImagesForUpload(files, options)

export const appendCompressedImageToFormData = async (
  formData,
  fieldName,
  file,
  options = {},
) => {
  if (!formData || !fieldName || !file) return formData
  formData.append(fieldName, await prepareUploadFile(file, options))
  return formData
}

export const appendCompressedImagesToFormData = async (
  formData,
  fieldName,
  files,
  options = {},
) => {
  if (!formData || !fieldName) return formData
  const preparedFiles = await prepareUploadFiles(files, options)
  preparedFiles.forEach((file) => formData.append(fieldName, file))
  return formData
}
