import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

export function compressImage(file, maxSize = 1600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) {
          reject(new Error('Could not read that photo. If this is an iPhone HEIC photo, set the camera to Most Compatible and take it again.'));
        } else {
          resolve(blob);
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo. If this is an iPhone HEIC photo, set the camera to Most Compatible and take it again.'));
    };
    img.src = url;
  });
}

export async function uploadImage(path, blob, contentType) {
  await uploadBytes(storageRef(storage, path), blob, { contentType: contentType || blob.type || 'image/jpeg' });
  return path;
}

export async function downloadUrl(path) {
  if (!path) return '';
  return getDownloadURL(storageRef(storage, path));
}

export async function removeImage(path) {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch (error) {
    if (!/object-not-found|storage\/object-not-found/i.test(String(error && error.code))) {
      throw error;
    }
  }
}
