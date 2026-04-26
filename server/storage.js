// Supabase Storage wrapper for `user_coffee_images`. Lazy-init keeps the
// singleton out of test envs that don't set the credentials.
//
// Public bucket layout: <bucket>/<user_id>/<user_coffee_id>.<ext>. Bucket
// SHOULD be private; reads happen exclusively via short-lived signed URLs
// returned by `GET /api/user-coffee/:id/image`.

import { createClient } from '@supabase/supabase-js';

import { log } from './logger.js';

const DEFAULT_BUCKET = 'coffee-label-images';
// 1 h is enough to ride out a typical session of inventory browsing without
// re-signing on every list mount, while still being short enough that a leaked
// URL stops working within the same day.
const DEFAULT_DOWNLOAD_TTL = 60 * 60; // 1 h

let client = null;

const getClient = () => {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
};

export const storageEnabled = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const bucketName = () =>
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;

const extensionForContentType = (contentType) => {
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('heic')) return 'heic';
  return 'jpg';
};

export const buildStoragePath = (userId, userCoffeeId, contentType) => {
  const safeUser = String(userId).replace(/[^A-Za-z0-9_-]/g, '_');
  return `${safeUser}/${userCoffeeId}.${extensionForContentType(contentType)}`;
};

export const isPathOwnedByUser = (storagePath, userId) =>
  typeof storagePath === 'string'
  && storagePath.startsWith(`${String(userId).replace(/[^A-Za-z0-9_-]/g, '_')}/`);

export const createUploadSignedUrl = async ({ userId, userCoffeeId, contentType }) => {
  const supabase = getClient();
  if (!supabase) return null;
  const path = buildStoragePath(userId, userCoffeeId, contentType);
  try {
    const { data, error } = await supabase.storage
      .from(bucketName())
      .createSignedUploadUrl(path);
    if (error) {
      log.warn('storage createSignedUploadUrl failed', { error: error.message });
      return null;
    }
    return {
      uploadUrl: data?.signedUrl ?? data?.signedURL ?? null,
      token: data?.token ?? null,
      storagePath: path,
    };
  } catch (err) {
    log.warn('storage createSignedUploadUrl threw', { error: err?.message });
    return null;
  }
};

export const createDownloadSignedUrl = async (storagePath, expiresInSec = DEFAULT_DOWNLOAD_TTL) => {
  const supabase = getClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(bucketName())
      .createSignedUrl(storagePath, expiresInSec);
    if (error) {
      log.warn('storage createSignedUrl failed', { error: error.message, storagePath });
      return null;
    }
    return {
      url: data?.signedUrl ?? data?.signedURL ?? null,
      expiresIn: expiresInSec,
    };
  } catch (err) {
    log.warn('storage createSignedUrl threw', { error: err?.message });
    return null;
  }
};

export const deleteStorageObject = async (storagePath) => {
  const supabase = getClient();
  if (!supabase || !storagePath) return false;
  try {
    const { error } = await supabase.storage.from(bucketName()).remove([storagePath]);
    if (error) {
      log.warn('storage remove failed', { error: error.message, storagePath });
      return false;
    }
    return true;
  } catch (err) {
    log.warn('storage remove threw', { error: err?.message });
    return false;
  }
};
